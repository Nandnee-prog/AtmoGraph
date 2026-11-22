from backend.nlp.preprocessing import clean_text
from backend.nlp.disruption_detection import detect_disruption


def process_news(text):
    cleaned_text = clean_text(text)
    disruption = detect_disruption(cleaned_text)

    return {
        "original_text": text,
        "cleaned_text": cleaned_text,
        "disruption": disruption
    }