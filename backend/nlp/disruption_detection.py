def detect_disruption(text):
    keywords = {
        "flood": "Natural Disaster",
        "flooding": "Natural Disaster",
        "earthquake": "Natural Disaster",
        "fire": "Fire",
        "strike": "Labor Disruption",
        "shortage": "Supply Shortage",
        "shutdown": "Factory Shutdown",
        "closed": "Closure",
        "delay": "Transport Delay",
        "delayed": "Transport Delay",
        "port closure": "Port Disruption"
    }

    text = text.lower()

    detected_disruptions = []

    for keyword, category in keywords.items():
        if keyword in text and category not in detected_disruptions:
            detected_disruptions.append(category)

    if detected_disruptions:
        return detected_disruptions

    return ["No disruption detected"]