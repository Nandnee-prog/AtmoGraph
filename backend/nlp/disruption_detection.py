def detect_disruption(text):
    keywords = {
        "flood": "Natural Disaster",
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

    for keyword, category in keywords.items():
        if keyword in text:
            return category

    return "No disruption detected"