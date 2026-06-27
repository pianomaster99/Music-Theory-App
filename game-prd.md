# Multiplayer Game
## Game Modes
1. Noobs - This only includes intervals. Example round is pianomaster99 asks the player to input, through audio, a certain interval with conditions. 
2. Pros - This includes chords and intervals. Example round is pianomaster99 asks the player to input, through audio, a certain interval or chord with conditions. The interval questions could require knowledge of chords, like what is the lower interval in a root major triad.
3. Hackers - This includes chords and intervals, but could also other knowledge. For example, it could ask the user to input, through audio, in a chord, the beginning key of Beethoven's fifth symphony. It should also include questions from the previous two modes.
## Game description
Each player, who has a username, has a rocket ship. Each question they get right, their rocket gets a boost. Every 3 questions they get right, they get a bigger boost, like it counts as 2 answers right. We can set like 10 answers right to get to finish line and finish race. 
## Implementation
Use the ML feature to detect pitches. To prevent detection of wavering, the singer needs to hold the note for at least like 0.50, this number can be adjusted, seconds in order to register the note because if the singer just wavers to a different note for like .1 seconds, it shouldnt change the registered note. Each question should have an array, usually either 2 or 3 elements, of pitches as the right answer, so if the most recent notes match the array, the player gets the right answer. Order shouldnt matter. 
## UI
The rockets only move relative to each other. The background will move backwards to give feeling that everyone is moving fowards. You should cross a finish line once you finish the race.
## Features
1. A skip question button
1. People can play as guests
1. A global leaderboard with fastest times.
1. An queue, so you can play with random people.
1. Play middle A (440 hrz) feature.
1. A solo mode
## Question Generation
I actually want to create an agent to generate all the questions before each round. Have like a total of 20 questions. I want to use an agent because I want do not want the questions to be formulaic and repetitive. To do this, I want the agent to research interesting ways to ask questions such that the answer should come in the form a set of pitches, like an interval or a chord. However, the question generation process should be limited to 10 seconds if possible. 
## Tech stack
1. Use OpenAI key for question generation
1. Rest of tech stack should be identical with rest of app.