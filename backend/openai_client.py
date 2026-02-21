import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError

from schemas import FlashcardsOut, QuizOut, StudyPlanOut

load_dotenv(Path(__file__).parent / ".env", override=True)

FLASHCARD_PROMPT = (
    "You are a flashcard generator. Given notes, respond with ONLY a JSON object "
    "in this exact format: "
    '{"flashcards": [{"question": "...", "answer": "..."}]} '
    "No markdown, no extra text, only the JSON object."
)

QUIZ_PROMPT = (
    "You are a quiz generator. Given notes, create a multiple-choice quiz. "
    "Respond with ONLY a JSON object in this exact format: "
    '{"quiz": [{"question": "...", "choices": ["choice 1", "choice 2", "choice 3", "choice 4"], "answer": "choice 1"}]} '
    "Each item must have exactly 4 choices as plain text (no A/B/C/D prefixes). "
    "The answer field must be the EXACT full text of the correct choice. "
    "No markdown, no extra text, only the JSON object."
)

STUDY_PLAN_PROMPT = (
    "You are a study planner. Given notes, create a 7-day study plan. "
    "Respond with ONLY a JSON object in this exact format: "
    '{"plan": [{"day": 1, "focus": "Topic name", "tasks": ["task 1", "task 2"]}]} '
    "Include exactly 7 days (day 1 through 7). Each day has a focus topic and 2-4 tasks. "
    "No markdown, no extra text, only the JSON object."
)


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set in environment")
    return OpenAI(api_key=api_key)


def _call_openai(system_prompt: str, content: str) -> dict:
    """Send a prompt to OpenAI and return parsed JSON dict.

    Raises ValueError on non-JSON or empty responses.
    """
    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        temperature=0.3,
    )
    raw = response.choices[0].message.content or ""
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned non-JSON output: {e}. Raw: {raw[:200]}")


def create_flashcards(content: str) -> FlashcardsOut:
    data = _call_openai(FLASHCARD_PROMPT, content)
    try:
        return FlashcardsOut.model_validate(data)
    except ValidationError as e:
        raise ValueError(f"AI JSON did not match expected schema: {e}")


def create_quiz(content: str) -> QuizOut:
    data = _call_openai(QUIZ_PROMPT, content)
    try:
        return QuizOut.model_validate(data)
    except ValidationError as e:
        raise ValueError(f"AI JSON did not match expected schema: {e}")


def create_study_plan(content: str) -> StudyPlanOut:
    data = _call_openai(STUDY_PLAN_PROMPT, content)
    try:
        return StudyPlanOut.model_validate(data)
    except ValidationError as e:
        raise ValueError(f"AI JSON did not match expected schema: {e}")
