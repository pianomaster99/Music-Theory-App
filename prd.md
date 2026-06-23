# Music Theory App Product Requirements Document
## Introduction  
Music theory is often taught by drilling examples into the students head. However, recent advances in learning science show that figuring out the solution through interaction helps the studnet learn more effectively and efficiently.
## Core concept
Socratic Method
    - The user learns be interacting with the lesson
    - The user does NOT learn by simply memorizing
    - The lesson does not give them the answer. It should guide the student through the example statement and hints.
    - The user should make mistakes
## Objectives  
1. Tutor  
Pianomaster99 is our AI tutor that guides student through examples. In terms of UI, Pianomaster99 is a mascot that is visually inviting.
Pianomaster99's functionality includes
    1. Pianomaster99 introduces each set of examples by explaining the topic
    1. Pianomaster99 gives specific feedback to attempts that fail
    1. Pianomaster99 is able to give hints to guide the student in the right direction, not give them the solution.
    1. Pianomaster99 should be able to engage with the interface
        1. Drag notes on or off the staves
        1. Hitting the hand with a ruler on wrong answers.
1. General UI Design  
    1. For the piano, I want a simple, early mickey mouse cartoon design vibe.
    1. For the hand, I want a hyper realistic design
    1. For the buttons, I want typical modern round 3D buttons.
    1. For the text, I want medieval hand writing that is still easily legible.
    1. For the background, I want many templates, that could be taken from internet.  
    Examples:
        - Outerspace
        - Hyper realistic forest
        - Cartoon living room scene
        - eerie horror movie dungeon
        - Fictionaly candyland
        - Tung tung tung sahur background
        - etc.
    I want to background to engage with the lesson somehow. For example, the staff might be in a cage, or sitting on top of a cloud, or something like that. 
1. Interface  
A general layout for each lesson page  
    1. Explain the lesson content at the top
    1. Button near top to show table with for example, intervals and chords
    1. Interactive feature at center of the page
    1. Check work button near bottom
    1. Help/hint button near bottom
    1. When user requests a response, e.g. by checking or asking for help, Pianomaster99 should engage.
Currently, I have 3 feature ideas for each lesson  
    1. Use a single staff treble clef template, and allow user to drag notes onto the staffs
        - Detail: To deal with enharmonic spellings of notes, for white keys, we stick with the most basic spelling. For the black keys, we following the musescore convention. When a note is dragged downwards, i.e. from above, we make the note flat. When a note is dragged upwards, i.e. from below, we make the note sharp.
        - Open question: Should we add a button to change if the note is flat or sharp?
    1. Use a miniature piano template of 2 octaves, and allow user to drag a hand onto the piano. If a finger is clicked, it touches the key, waiting to press the key when the play button is pressed. The hand should have 6 degress of freedom: the hand and the 5 fingers. The hand should be able to move anywhere, and the fingers are positioned relative to the hand, thus move with the hand. The fingers should have limited freedom, i.e. it has about 30 degrees of rotational freedom. Do some experimenting to see how many degrees of freedom looks best. Also, the piano should have two states, unpressed and pressed, and should have an animation connecting the two. The fingers should have three states, which is above the key and on the key and pressing thekey, which should also have an animation connecting the two states. Clicking the finger changes between above and on the key, while the submit/play button actually plays the notes. 
    1. Have a table that can open when requested. This contains information for intervals, e.g. how many notes in the interval. For chords, include information on the intervals in each chord. The table should also be able to generate examples for everything. 
1. Audio  
    - The tutor should speak whatever it types out.
    - Each time a note is dragged onto the staff, it plays the pitch it lands on.
    - Allow the user to customize the tutor's speaking sound
    - Allow the user to customize what instrument plays the notes from the grandstaff
    - Each time a note lands on 
1. Onboarding  
    1. Username
    1. Customize hand ui, options include male or female hand, and skin color
    1. How long the user plans to the app for (this will determine how many questions we give them for each module)
    1. Ask for their experience based on the content of the modules
1. Curriculum  
Currently, we aim to have 3 modules, which has a few lessons in each module.  
    1. Intervals
        1. Perfect intervals
        1. Consonant Intervals
        1. Dissonant Intervals
    1. Triads
        1. Major Chords
        1. Minor Chords
        1. Diminished Chords (Bonus)
        1. Augmented Chords (Bonus)
    1. Seventh Chords
        1. Major Seventh Chord
        1. Minor Seventh Chord
        1. Dominant Seventh Chord
        1. Dimished Seventh Chord
        1. Half-dimished Seventh Chord
Should be able to generate random examples for the lessons.  
Examples:  
    1. Intervals
        - Begin with one note on the staff, and ask student to drag second note to make the interval. Make sure to specify above or below the given note.
        - Drag two notes to make the target interval (doesn't hnecessarily ave to start on a specific note)
        - Identify interval given on the staff
        - Drag hand and fingers to form the target interval
        - Identify interval that the hand is playing
    1. Triads/Seventh Chords
        - Drag notes to make target chord
        - Begin with one note on the staff, and ask student to drag notes to complete the specified chord. 
        - Identify chord given on the staff
        - Identify chord that hand is playing
        - Drag hand and fingers to form the target chord
For the identify interval/chord, make it interactive by dragging things.
For example, for identifying interval, have them drag the number and then the letter, i.e. M or m, in front of the number as an examples.  
Key: For each lesson, introduce the example, explain the task, but do not give the solution.
1. Feedback
    1. Each lesson should have specific feedback based on the user's current progress in the lesson.
    1. If the student technically has the right note but the wrong enharmonic spelling, tell the user that they are so close, they are just using the wrong spelling of the note.
    1. If the student is mixing up perfect, dissonant, and consant intervals, ask them to listen to how the interval makes them feel. Perfect should be satisfying, consonant should be smooth/chill, dissonant should be like OUCH! same idea behind adding adjectives behind chords.
    1. If the student is 
1. Progress Tracker  
    1. The progress tracker should keep track of what modules/lessons that the user has completed
    1. Daily streak
1. Persistence  
    1. The user should be able to resume their progress in a lesson after exiting the website.
1. Mobile
    1. The web app should be formatted well for different screens, such as mobile, as well.

## MVP
## User persona
The general user is a beginner in piano playing who wants to know how music is constructed.  
Prerequisites of the general user  
    1. Reads English
    1. Ability to read sheet music
    1. Ability to correspond notes on a sheet to keys on a piano
Ideal Customer Profile
    1. A student who has been studying with a piano teacher for at least a month, but no longer than at most 2 years.
## User story
1. A seven year old kid whose mom has taught him how to play fur elise and alla turca, and now his mom wants him to learn music theory. He logs onto the app for 20 minutes everyday because his mom forces him to. He makes a lot of mistakes at first, and requires assistance from Pianomaster99. Pianomaster99 should explain concepts in very simple terms so that the seven year old kid cann understand.
1. A 25 year old dude who has free time and is a self taught pianist. He wants to learn music theory in order to compose his own music. He tries to do 1 module a day. 
## Open questions
1. Should we add a graduation module?
1. What are other types of lessons we can add?
## Tech stack
1. Vite React
1. Firestore from Firebase (currently in test mode)  
Keep it simple for now, and don't use other software unless I tell you  
Do not curl anything onto my computer without permission
## Milestones
