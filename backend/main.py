from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy.orm import Session

from sqlalchemy import inspect, text

from database import Base, engine, get_db
from models import FlashcardSet, Note, NoteGroup, QuizSet, StudyPlan
from openai_client import create_flashcards, create_quiz, create_study_plan
from schemas import (
    FlashcardSetOut,
    FlashcardsOut,
    GroupCreate,
    GroupOut,
    NoteCreate,
    NoteOut,
    QuizOut,
    StudyPlanOut,
)

app = FastAPI()


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    _add_group_id_columns()


def _add_group_id_columns():
    """Add group_id column to study tables if missing (no-op once applied)."""
    inspector = inspect(engine)
    tables = ["flashcard_sets", "quiz_sets", "study_plans"]
    with engine.begin() as conn:
        for table in tables:
            if not inspector.has_table(table):
                continue
            columns = [c["name"] for c in inspector.get_columns(table)]
            if "group_id" not in columns:
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN group_id INTEGER "
                    f"REFERENCES note_groups(id) ON DELETE CASCADE"
                ))
            if "note_id" in columns:
                conn.execute(text(
                    f"ALTER TABLE {table} ALTER COLUMN note_id DROP NOT NULL"
                ))


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    note = Note(title=payload.title, content=payload.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@app.get("/api/notes", response_model=list[NoteOut])
def list_notes(db: Session = Depends(get_db)):
    return db.query(Note).order_by(Note.created_at.desc()).all()


@app.get("/api/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.delete("/api/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()


@app.post("/api/notes/{note_id}/flashcards", response_model=FlashcardsOut)
def generate_flashcards(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    try:
        result = create_flashcards(note.content)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI output invalid: {e}")

    flashcard_set = FlashcardSet(note_id=note.id, json_data=result.model_dump())
    db.add(flashcard_set)
    db.commit()

    return result


@app.get("/api/notes/{note_id}/flashcards/latest", response_model=FlashcardsOut)
def get_latest_flashcards(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    latest = (
        db.query(FlashcardSet)
        .filter(FlashcardSet.note_id == note_id)
        .order_by(FlashcardSet.created_at.desc(), FlashcardSet.id.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No flashcards found for this note")

    try:
        return FlashcardsOut.model_validate(latest.json_data)
    except ValueError:
        raise HTTPException(status_code=500, detail="Stored flashcards are invalid")


@app.get("/api/notes/{note_id}/flashcards/history", response_model=list[FlashcardSetOut])
def list_flashcard_history(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    history = (
        db.query(FlashcardSet)
        .filter(FlashcardSet.note_id == note_id)
        .order_by(FlashcardSet.created_at.desc(), FlashcardSet.id.desc())
        .all()
    )

    items: list[FlashcardSetOut] = []
    for row in history:
        try:
            validated = FlashcardsOut.model_validate(row.json_data)
        except ValueError:
            # Skip corrupted historical rows instead of failing the endpoint.
            continue
        items.append(
            FlashcardSetOut(
                id=row.id,
                note_id=row.note_id,
                created_at=row.created_at,
                flashcards=validated.flashcards,
            )
        )
    return items


# ── Quiz endpoints ──────────────────────────────────────────────


@app.post("/api/notes/{note_id}/quiz", response_model=QuizOut)
def generate_quiz(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    try:
        result = create_quiz(note.content)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI output invalid: {e}")

    quiz_set = QuizSet(note_id=note.id, json_data=result.model_dump())
    db.add(quiz_set)
    db.commit()

    return result


@app.get("/api/notes/{note_id}/quiz/latest", response_model=QuizOut)
def get_latest_quiz(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    latest = (
        db.query(QuizSet)
        .filter(QuizSet.note_id == note_id)
        .order_by(QuizSet.created_at.desc(), QuizSet.id.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No quiz found for this note")

    try:
        return QuizOut.model_validate(latest.json_data)
    except ValueError:
        raise HTTPException(status_code=500, detail="Stored quiz is invalid")


# ── Study Plan endpoints ────────────────────────────────────────


@app.post("/api/notes/{note_id}/study-plan", response_model=StudyPlanOut)
def generate_study_plan(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    try:
        result = create_study_plan(note.content)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI output invalid: {e}")

    plan = StudyPlan(note_id=note.id, json_data=result.model_dump())
    db.add(plan)
    db.commit()

    return result


@app.get("/api/notes/{note_id}/study-plan/latest", response_model=StudyPlanOut)
def get_latest_study_plan(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    latest = (
        db.query(StudyPlan)
        .filter(StudyPlan.note_id == note_id)
        .order_by(StudyPlan.created_at.desc(), StudyPlan.id.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No study plan found for this note")

    try:
        return StudyPlanOut.model_validate(latest.json_data)
    except ValueError:
        raise HTTPException(status_code=500, detail="Stored study plan is invalid")


# ── Group endpoints ─────────────────────────────────────────────


def _get_group_or_404(group_id: int, db: Session) -> NoteGroup:
    group = db.query(NoteGroup).filter(NoteGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def _combined_content(group: NoteGroup) -> str:
    if not group.notes:
        raise HTTPException(status_code=400, detail="Group has no notes")
    return "\n\n---\n\n".join(n.content for n in group.notes)


@app.post("/api/groups", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupCreate, db: Session = Depends(get_db)):
    notes = db.query(Note).filter(Note.id.in_(payload.note_ids)).all()
    if len(notes) != len(payload.note_ids):
        raise HTTPException(status_code=404, detail="One or more notes not found")

    group = NoteGroup(name=payload.name)
    group.notes = notes
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@app.get("/api/groups", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db)):
    return db.query(NoteGroup).order_by(NoteGroup.created_at.desc()).all()


@app.get("/api/groups/{group_id}", response_model=GroupOut)
def get_group(group_id: int, db: Session = Depends(get_db)):
    return _get_group_or_404(group_id, db)


@app.delete("/api/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = _get_group_or_404(group_id, db)
    db.delete(group)
    db.commit()


@app.post("/api/groups/{group_id}/flashcards", response_model=FlashcardsOut)
def generate_group_flashcards(group_id: int, db: Session = Depends(get_db)):
    group = _get_group_or_404(group_id, db)
    try:
        result = create_flashcards(_combined_content(group))
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI output invalid: {e}")

    flashcard_set = FlashcardSet(group_id=group.id, json_data=result.model_dump())
    db.add(flashcard_set)
    db.commit()

    return result


@app.get("/api/groups/{group_id}/flashcards/latest", response_model=FlashcardsOut)
def get_latest_group_flashcards(group_id: int, db: Session = Depends(get_db)):
    _get_group_or_404(group_id, db)
    latest = (
        db.query(FlashcardSet)
        .filter(FlashcardSet.group_id == group_id)
        .order_by(FlashcardSet.created_at.desc(), FlashcardSet.id.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No flashcards found for this group")
    try:
        return FlashcardsOut.model_validate(latest.json_data)
    except ValueError:
        raise HTTPException(status_code=500, detail="Stored flashcards are invalid")


@app.post("/api/groups/{group_id}/quiz", response_model=QuizOut)
def generate_group_quiz(group_id: int, db: Session = Depends(get_db)):
    group = _get_group_or_404(group_id, db)
    try:
        result = create_quiz(_combined_content(group))
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI output invalid: {e}")

    quiz_set = QuizSet(group_id=group.id, json_data=result.model_dump())
    db.add(quiz_set)
    db.commit()

    return result


@app.get("/api/groups/{group_id}/quiz/latest", response_model=QuizOut)
def get_latest_group_quiz(group_id: int, db: Session = Depends(get_db)):
    _get_group_or_404(group_id, db)
    latest = (
        db.query(QuizSet)
        .filter(QuizSet.group_id == group_id)
        .order_by(QuizSet.created_at.desc(), QuizSet.id.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No quiz found for this group")
    try:
        return QuizOut.model_validate(latest.json_data)
    except ValueError:
        raise HTTPException(status_code=500, detail="Stored quiz is invalid")


@app.post("/api/groups/{group_id}/study-plan", response_model=StudyPlanOut)
def generate_group_study_plan(group_id: int, db: Session = Depends(get_db)):
    group = _get_group_or_404(group_id, db)
    try:
        result = create_study_plan(_combined_content(group))
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI output invalid: {e}")

    plan_row = StudyPlan(group_id=group.id, json_data=result.model_dump())
    db.add(plan_row)
    db.commit()

    return result


@app.get("/api/groups/{group_id}/study-plan/latest", response_model=StudyPlanOut)
def get_latest_group_study_plan(group_id: int, db: Session = Depends(get_db)):
    _get_group_or_404(group_id, db)
    latest = (
        db.query(StudyPlan)
        .filter(StudyPlan.group_id == group_id)
        .order_by(StudyPlan.created_at.desc(), StudyPlan.id.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No study plan found for this group")
    try:
        return StudyPlanOut.model_validate(latest.json_data)
    except ValueError:
        raise HTTPException(status_code=500, detail="Stored study plan is invalid")
