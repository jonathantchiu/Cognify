from datetime import datetime

from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)


class NoteUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)


class NoteOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Flashcard(BaseModel):
    question: str
    answer: str


class FlashcardsOut(BaseModel):
    flashcards: list[Flashcard]


class FlashcardSetOut(BaseModel):
    id: int
    note_id: int
    created_at: datetime
    flashcards: list[Flashcard]


class QuizQuestion(BaseModel):
    question: str
    choices: list[str]
    answer: str


class QuizOut(BaseModel):
    quiz: list[QuizQuestion]


class StudyDay(BaseModel):
    day: int
    focus: str
    tasks: list[str]


class StudyPlanOut(BaseModel):
    plan: list[StudyDay]


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    note_ids: list[int] = Field(..., min_length=2)


class GroupOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    notes: list[NoteOut]

    model_config = {"from_attributes": True}
