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
The MVP is the full product with every objective above met. We are not shipping a reduced subset — the MVP is "done" only when all of the following objectives are implemented and working together. The milestones below break this scope into features so we can build toward it in order.

The MVP must include all objectives:  
    1. Tutor — Pianomaster99 introduces each topic, gives specific feedback on failed attempts, gives non-revealing hints, and engages with the interface (including dragging notes on/off the staves and the ruler-slap reaction on wrong answers).
    1. General UI Design — the full visual direction: early-Mickey-Mouse-style cartoon piano, hyper-realistic hand, modern round 3D buttons, medieval-but-legible text, and multiple swappable backgrounds that engage with the lesson.
    1. Interface — the standard lesson layout: lesson explanation at the top, a button to open the reference table, the interactive feature in the center, and Check work and Help/hint buttons near the bottom, with Pianomaster99 engaging on check/help.
    1. All three interactive features — the single-staff treble clef with draggable notes (including enharmonic spelling logic), the miniature 2-octave piano with the draggable hand, and the openable reference table that can also generate examples.
    1. Audio — the tutor speaks what it types, a note plays its pitch when it lands on the staff, and the user can customize both the tutor's speaking voice and the instrument that plays the notes.
    1. Onboarding — username, hand UI customization (male/female hand and skin color), expected usage time (drives number of questions per module), and self-reported experience.
    1. Curriculum — all three modules (Intervals, Triads, Seventh Chords) with their lessons, plus random example generation for every lesson.
    1. Feedback — lesson-specific feedback based on the user's current progress, including the right-note/wrong-enharmonic-spelling case and the perfect/consonant/dissonant "how does it feel" guidance.
    1. Progress Tracker — tracks completed modules/lessons and maintains a daily streak.
    1. Persistence — users can exit the website and resume their progress where they left off.
    1. Mobile — the app is formatted well across screen sizes, including mobile.

MVP success criteria  
    1. A new user can onboard, work through all three modules end to end, and have their progress persist across sessions and devices.
    1. The hint/feedback loop helps users arrive at answers themselves rather than being handed the solution.

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
1. A 16 year old high school student who plays piano in jazz band and can already read sheet music fluently. She knows some theory by ear but not the formal names. She wants to quickly identify the lessons she already knows and skip ahead, so onboarding should let her self-report experience and the app should not force her to grind through content that is too easy.
1. A 40 year old adult returning to piano after quitting lessons as a child. He is rusty, easily discouraged, and only has about 10 minutes at a time. He needs short sessions, gentle and encouraging feedback from Pianomaster99, and the ability to resume exactly where he left off.
1. A piano teacher who tries the app to decide whether to recommend it to her students. She wants the lessons to be theoretically correct (especially enharmonic spelling) and the hints to teach the underlying reasoning rather than just reveal answers. She cares that a struggling student is guided, not given the solution.
1. A returning user coming back after two weeks away. They want the app to remember which modules and lessons they have completed and drop them back into their progress without having to redo finished lessons.
## Open questions
1. Should we add a graduation module?
1. What are other types of lessons we can add?
## Tech stack
1. Vite React
1. Firestore from Firebase (currently in test mode)  
Keep it simple for now, and don't use other software unless I tell you  
Do not curl anything onto my computer without permission
## Milestones
Built feature by feature, in this order. Each feature should be demoable on its own and builds on the previous ones. All of these together make up the MVP (every objective met).

1. Project & data foundation
    1. Vite + React app running; Firebase/Firestore connected (currently in test mode) with basic read/write verified.
    1. Define the Firestore data model (user profile, per-module/lesson progress, attempt history).
1. Lesson page shell (Interface)
    1. The standard lesson layout: explanation at top, interactive area in the center, reference-table button near the top, and Check work + Help/hint buttons near the bottom.
    1. A placeholder Pianomaster99 mascot on the page (final art comes later).
1. Interactive staff feature
    1. Single-staff treble clef where the user drags notes on and off the staff.
    1. Enharmonic spelling logic: white keys use the basic spelling; black keys follow the MuseScore convention (dragging down = flat, dragging up = sharp).
1. Audio engine
    1. A note plays its pitch when it lands on the staff.
    1. Text-to-speech so the tutor can speak whatever it types.
1. Pianomaster99 tutor logic
    1. Introduces each topic, gives specific feedback on failed attempts, and gives hints that guide without revealing the answer.
    1. Engages with the interface (e.g. dragging notes on/off the staves) when the user checks work or asks for help.
1. Intervals module
    1. Lessons for Perfect, Consonant, and Dissonant intervals.
    1. Random example generation (drag second note above/below a given note, drag two notes to form an interval, identify the interval, drag the M/m label, etc.).
    1. Lesson-specific feedback, including the right-note/wrong-enharmonic-spelling case and the "how does the interval feel" guidance.
1. Reference table feature
    1. Openable table with interval info (e.g. number of notes) and chord info (the intervals in each chord).
    1. Can generate examples for everything in the table.
1. Triads module
    1. Lessons for Major, Minor, and bonus Diminished/Augmented chords.
    1. Example generation and chord-specific feedback, reusing the staff + tutor systems.
1. Seventh Chords module
    1. Lessons for Major 7th, Minor 7th, Dominant 7th, and bonus Diminished/Half-diminished 7th chords.
    1. Example generation and feedback.
1. Miniature piano + draggable hand feature
    1. Miniature 2-octave piano with unpressed/pressed states and a connecting animation.
    1. Draggable hand with 6 degrees of freedom (hand + 5 fingers); fingers have limited rotation and move relative to the hand. Finger states: above key / on key / pressing, with animations; clicking toggles above/on, and the play button presses.
    1. Interval and chord examples that use the hand instead of (or alongside) the staff.
1. Accounts & authentication
    1. Email/password auth (per the tech stack) so progress can be tied to a user.
    1. Tighten Firestore security rules from test mode to per-user access.
1. Onboarding
    1. Collect username, hand UI customization (male/female hand and skin color), expected usage time (drives questions per module), and self-reported experience across the modules.
1. Progress tracker
    1. Track completed modules/lessons.
    1. Daily streak.
1. Persistence
    1. Save and restore progress via Firestore so users can exit the site and resume where they left off (across devices once accounts exist).
1. General UI design & theming
    1. Early-Mickey-Mouse-style cartoon piano, hyper-realistic hand, modern round 3D buttons, and medieval-but-legible text.
    1. Multiple swappable backgrounds (outerspace, forest, living room, dungeon, candyland, etc.) that engage with the lesson (e.g. staff in a cage or on a cloud).
1. Audio & avatar customization
    1. Customize the tutor's speaking voice and the instrument that plays the notes.
1. Mobile & responsiveness
    1. Lay out and test the app well across screen sizes, including mobile.
1. Ruler-slap reaction
    1. Pianomaster99 hits the hand with a ruler on wrong answers (animation + audio).
