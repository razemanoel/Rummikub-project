# Rummikub Vision Service

FastAPI + Python module for Rummikub validation and optimal move solving using Integer Linear Programming (ILP).

## Features

* **Board Validation**: Validate game rules (runs, groups, jokers)
* **Game State Analysis**: Check if game state follows Rummikub rules
* **Optimal Move Solver**: Find the best legal move that removes the maximum number of tiles from the player's rack
* **Joker Support**: Support up to 2 jokers in runs and groups
* **Move Explanation**: Return human-readable steps that explain how to perform the move

## Prerequisites

* Python 3.8+
* pip or conda

## Installation

```bash
pip install -r requirements.txt
```

## Project Structure

```text
vision/
├── main.py              # FastAPI application and endpoints
├── models.py            # Pydantic data models
├── logic.py             # Game logic and validation
├── solver_ilp.py        # ILP-based optimal move solver
├── explainer.py         # Human-readable move explanations
├── __init__.py          # Package initialization
├── requirements.txt     # Python dependencies
└── README.md            # This file
```

## API Endpoints

### Health Check

* `GET /health` - Service health status

### Validation

* `POST /validate-board` - Validate board sets
* `POST /validate-game-state` - Validate full game state

### Solver

* `POST /solve-ilp` - Find the optimal legal move using ILP

## Running the Service

### Development

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The service will start on:

```text
http://localhost:8000
```

API documentation is available at:

```text
http://localhost:8000/docs
```

Use Swagger to test the API directly from the browser.

## Game Logic

The system validates individual sets and complete game states.

It checks:

* Runs: consecutive numbers with the same color
* Groups: same number with different colors
* Joker usage
* Duplicate colors in groups
* Duplicate values in runs
* Minimum set size
* Values between 1 and 13

## Game Rules Implemented

### Valid Set - Run

* 3+ consecutive numbers
* Same color
* Jokers can fill gaps
* Values must stay within 1-13

Example:

```text
3 blue, 4 blue, 5 blue
```

### Valid Set - Group

* 3-4 tiles
* Same number
* Different colors
* Jokers can substitute missing colors

Example:

```text
8 red, 8 blue, 8 black
```

### Invalid Cases

* Duplicate colors in group
* Duplicate values in run
* Wrong number of tiles
* Insufficient jokers for gaps
* More than 2 jokers in the game

## Optimal Solver

The solver uses Integer Linear Programming (ILP) to find the best legal move.

The optimization goal is:

```text
Maximize the number of tiles removed from the player's rack.
```

The solver can:

* Keep existing board sets
* Add rack tiles to existing sets
* Create new sets from rack tiles
* Break and rebuild board sets
* Combine rack tiles with board tiles
* Use jokers optimally
* Return the final board arrangement
* Return detailed steps for the player

## Joker Handling

The solver supports up to 2 jokers.

A joker can:

* Complete a run
* Complete a group
* Extend a run from the beginning
* Extend a run from the end
* Fill a missing value in the middle of a run

Example:

```text
3 blue, joker, 5 blue
```

The joker can represent:

```text
4 blue
```

The response includes `joker_assignments`, which explains what each joker represents.

## Move Explanation

The solver returns `steps`, which explain how the player should perform the move.

The explanation can include:

* Keep an existing set unchanged
* Add tiles to an existing set
* Create a new set from rack tiles
* Break and rearrange board sets
* Create mixed sets from rack and board tiles
* Explain joker usage
* Show which tiles remain in the rack

Example:

```text
Keep board set #1 unchanged: 3 black, 3 blue, 3 red
Add 7 blue to board set #0: 3 blue, 4 blue, 5 blue, 6 blue -> 3 blue, 4 blue, 5 blue, 6 blue, 7 blue
Create a new set from your rack: 8 red, 8 blue, 8 black
Use a joker as 11 blue in a run
```

## Request / Response Examples

### Validate Board

Request:

```json
{
  "board": [
    {
      "tiles": [
        { "value": 1, "color": "red", "is_joker": false },
        { "value": 2, "color": "red", "is_joker": false },
        { "value": 3, "color": "red", "is_joker": false }
      ]
    }
  ]
}
```

Response:

```json
{
  "status": "success",
  "message": "All sets on the board are valid",
  "invalid_sets": []
}
```

### Solve ILP

Request:

```json
{
  "rack": [
    { "value": null, "color": null, "is_joker": true },
    { "value": 7, "color": "blue", "is_joker": false },
    { "value": 8, "color": "blue", "is_joker": false },
    { "value": 8, "color": "red", "is_joker": false },
    { "value": 8, "color": "black", "is_joker": false },
    { "value": 12, "color": "blue", "is_joker": false },
    { "value": 13, "color": "blue", "is_joker": false }
  ],
  "board": [
    {
      "tiles": [
        { "value": 3, "color": "blue", "is_joker": false },
        { "value": 4, "color": "blue", "is_joker": false },
        { "value": 5, "color": "blue", "is_joker": false },
        { "value": 6, "color": "blue", "is_joker": false }
      ]
    },
    {
      "tiles": [
        { "value": 3, "color": "red", "is_joker": false },
        { "value": 3, "color": "blue", "is_joker": false },
        { "value": 3, "color": "black", "is_joker": false }
      ]
    }
  ]
}
```

Response:

```json
{
  "status": "success",
  "message": "ILP solved successfully",
  "solver_status": "Optimal",
  "candidate_count": 117,
  "solve_time_seconds": 0.1079,
  "tiles_used_count": 7,
  "remaining_rack": [],
  "new_board": [
    {
      "tiles": [
        { "value": 3, "color": "black", "is_joker": false },
        { "value": 3, "color": "blue", "is_joker": false },
        { "value": 3, "color": "red", "is_joker": false }
      ]
    },
    {
      "tiles": [
        { "value": 8, "color": "black", "is_joker": false },
        { "value": 8, "color": "blue", "is_joker": false },
        { "value": 8, "color": "red", "is_joker": false }
      ]
    },
    {
      "tiles": [
        { "value": 3, "color": "blue", "is_joker": false },
        { "value": 4, "color": "blue", "is_joker": false },
        { "value": 5, "color": "blue", "is_joker": false },
        { "value": 6, "color": "blue", "is_joker": false },
        { "value": 7, "color": "blue", "is_joker": false }
      ]
    },
    {
      "tiles": [
        { "value": 11, "color": "blue", "is_joker": true },
        { "value": 12, "color": "blue", "is_joker": false },
        { "value": 13, "color": "blue", "is_joker": false }
      ]
    }
  ],
  "joker_assignments": [
    {
      "value": 11,
      "color": "blue",
      "type": "run"
    }
  ],
  "steps": [
    "Keep board set #1 unchanged: 3 black, 3 blue, 3 red",
    "Add 7 blue to board set #0: 3 blue, 4 blue, 5 blue, 6 blue -> 3 blue, 4 blue, 5 blue, 6 blue, 7 blue",
    "Create a new set from your rack: 8 black, 8 blue, 8 red",
    "Create a new set from your rack: joker as 11 blue, 12 blue, 13 blue",
    "Joker usage:",
    "- Use a joker as 11 blue in a run",
    "No tiles remain in your rack."
  ]
}
```

## Response Fields

### `solver_status`

The ILP solver result.

Common value:

```text
Optimal
```

### `candidate_count`

The number of legal candidate sets generated before solving.

### `solve_time_seconds`

The time it took to solve the ILP problem.

### `tiles_used_count`

The number of tiles removed from the player's rack.

### `remaining_rack`

Tiles that could not be played.

### `new_board`

The final legal board arrangement after the optimal move.

### `joker_assignments`

Explains what each joker represents.

### `steps`

Human-readable instructions for the player.

## Dependencies

* **fastapi**: Web framework
* **uvicorn**: ASGI server
* **pydantic**: Data validation
* **pulp**: Integer Linear Programming solver
