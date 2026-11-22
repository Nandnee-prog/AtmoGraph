from backend.nlp.pipeline import process_news


test_cases = [
    "A fire caused shipment delays and material shortage.",
    "A flood and strike stopped factory production.",
    "The company reported record quarterly profits.",
    "An earthquake damaged the supplier factory."
]


for news in test_cases:
    result = process_news(news)
    print(result)
    print("-" * 50)