#Music Theory App Product Requirements Document
##Introduction
Music
##Problems and solutions
Socratic Method
##Objectives
1. Tutor
Pianomaster99 is our AI tutor that guides student through examples. 
In terms of UI, Pianomaster99 is a mascot that is visually inviting.
Pianomaster99's functionality includes
    1. Pianomaster99 introduces each set of examples by explaining the topic
    1. Pianomaster99 gives specific feedback to attempts that fail
    1. Pianomaster99 is able to give hints to guide the student in the right direction, not give them the solution.
    1. Pianomaster99 should be able to engage with the interface
        1. Drag notes on or off the staves
        1. Hitting the hand with a ruler on wrong answers.
1. Interface
A general layout for each lesson page
    1. Explain the lesson content at the top
    1. Button near top to show table with for example, intervals and chords
    1. Interactive feature at center of the page
    1. Check work button near bottom
    1. Help/hint button near bottom
    1. When user requests a response, e.g. by checking or asking for help, Pianomaster99 should engage.
Currently, I have 2 feature ideas for each lesson
    1. Use grand staff template, and allow user to drag notes onto the staffs
    1. Use a miniature piano template of 2 octaves, and allow user to drag a hand onto the piano. If a finger is clicked, it touches the key, waiting to press the key when the play button is pressed. The hand should have 6 degress of freedom: the hand and the 5 
1. Audio
    - The tutor should speak whatever it types out.
    - Each time a note is dragged onto the staff, it plays the pitch it lands on.
1. Onboarding
    1. Username
    1. Customize hand ui, options include male or female hand, and skin color
    1. How long the user plans to the app for (this will determine how many questions we give them for each module)
    1. Ask for their experience based on the content of the modules
    1. 
1. Curriculum
Currently, we aim to have 4 modules. 
    1. 
1. Progress Tracker

1. Persistence
1. Mobile
##MVP
##User persona
The general user is a beginner in piano playing who wants to know how music is constructed.
Prerequisites of the general user
    1. Reads English
    1. Ability to read sheet music
    1. Ability to correspond notes on a sheet to keys on a piano
Ideal Customer Profile
    1. A student who has been studying with a piano teacher for at least a month, but no longer than at most 2 years.
##User story
##Tech stack
1. Vite React
1. Firestore from Firebase (auth email and password are in .env file)
Do not curl anything onto my computer without permission
##Milestones
