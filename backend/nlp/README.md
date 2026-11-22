# AtmoGraph NLP & Data Processing

## Overview
This module processes supply-chain news text and identifies potential disruptions using a rule-based keyword detection approach.

## Components

### 1. Text Preprocessing
- Converts text to lowercase.
- Removes URLs.
- Normalizes extra whitespace.
- Removes leading and trailing whitespace.

### 2. Disruption Detection
Identifies disruption categories using keyword matching.

Current categories include:
- Natural Disaster
- Fire
- Labor Disruption
- Supply Shortage
- Factory Shutdown
- Closure
- Transport Delay
- Port Disruption

The system can identify multiple disruption categories in a single text.

### 3. NLP Pipeline
The pipeline combines preprocessing and disruption detection and returns:
- Original news text
- Cleaned news text
- Detected disruption categories

### 4. Testing
The test script (`test_disruption.py`) contains sample news sentences to check the functionality of the pipeline.

## Current Limitations
- Uses keyword-based rules rather than a trained machine learning model.
- May miss disruptions expressed using unfamiliar wording.
- May incorrectly detect disruptions when keywords appear in unrelated contexts.
- Does not currently identify company names using Named Entity Recognition (NER).
- Does not currently connect news mentions to company IDs in the Sectivia dataset.
- Does not currently account for negation or contextual meaning.

## Future Improvements
- Named Entity Recognition (NER).
- Company entity matching with the Sectivia dataset.
- Improved disruption classification.
- Integration with the AtmoGraph graph pipeline.