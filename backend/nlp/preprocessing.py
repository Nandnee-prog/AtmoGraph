import re

def clean_text(text):
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"\s+", " ", text)
    text = text.strip()

    return text


def remove_duplicates(news_list):
    unique_news = []

    for news in news_list:
        if news not in unique_news:
            unique_news.append(news)

    return unique_news