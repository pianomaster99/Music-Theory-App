# Pitch detection from audio stream
Currently, we focus on voice, as in a singing voice.
## Input
Constant audio stream. Open question is frame length, i.e. how many millisends for input frame. Each input is the audio signal at the most recent time step.
## Output
Pitch at each input frame.
## Model
Convolutional Recurrent Neural Network
## Data
Two methods for obtaining data  
### Synthetic data
We will use software to generate singing voices, but which software is still an open question.
### Real data
Use the internet to find samples of people singing, from all ages, languages, genders, and types of voices. 
There are two possibilities:
1. Find robust datasets with pitches labeled at each time step. To make this this dataset more robust, we will add noise to the data. Do research on all techniques to generate noised variations of each data point. This is an open question.
2. If no such datasets exist, we will find unlabeled data, and then use a free AI agent to try and go into each data point and label them. In essence, we are distilling a powerful llm/agent model into a fast/lightweight.
Do research on all techniques to generate noised variations of each data point, whether synthetic or real. This is an open question.
## Objectives
### Efficiency
The model is intended for a browser to run. Thus, it should be lightweight, i.e. minimal number of parameters, and run quickly
### Robustness
The goal is that the user should be able to sing a note in any environment, i.e. with background noise, and with any voice, e.g. child like, hoarse, nasally.
### Accuracy
We first prioritize accuracy, meaning that we want all the notes sung by the user to be detected. We also want notes not sung, perhaps noises from the background, to not be detected.
## Milestones
1. Decide on open questions
2. Generate the data (present the data to me)
3. Train model on this data

## Updated Data Generation Plan
We do lazy loading for data. Basically, we first find a few samples and train on that data. Then, if the training loss is not low enough, find more data. Then iterate until training loss is low enough. I want to use unlabeled data, so we should have a really big supply. For each data point, add robustness by adding noise, so we have original data and a few variations. Also try to add background noise for one type of noise. Then, I want to use the CREPE model as you used to label the data. This creates very fine-grained data, so after this pass, use another AI (could be any, including any OpenAI model because I have key) to turn this pitch-time data into something more coarse. What I mean is that when the voice wavers, or transitions between notes, we don't want to count that. Basically, the audio has to stay on the same pitch, or around the same pitch, for at least a certain number of frames in order for the sound to count. you can also add more rules as you think will work, but basically, we don't want noise in tthe final label. This is the final labeled data I want. You can also start training, which I already said in first sentence. Show me some of the labeled data you have with the original and noised audio after you generate some. 