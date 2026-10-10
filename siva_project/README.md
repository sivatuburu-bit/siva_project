# Campus Assistant Hub

Project Prompt: Voice-Based AI Campus Assistant

Develop a complete, modern, responsive Voice-Based AI Campus Assistant web application using React, Vite, Node.js, Express.js, Ollama AI, and Supabase.

1. Project Objective

Create an AI-powered campus assistant that helps students get information about college activities, courses, timetables, examinations, attendance, events, and campus facilities. Students should be able to interact with the assistant using both voice and text.

2. Technologies

Frontend: React.js, Vite, HTML, CSS, JavaScript

Backend: Node.js and Express.js

AI Model: Ollama

Authentication: Supabase Auth

Database: Supabase PostgreSQL

Voice Input: Web Speech API

Voice Output: SpeechSynthesis API

3. Main Features

A. Login and Registration

Create an attractive login page.

Create a student registration page.

Include email and password fields.

Integrate login and registration with Supabase Authentication.

Add password visibility and forgot-password functionality.

Display clear validation messages.

Protect private pages from unauthorized access.

Handle invalid credentials and API errors properly.

B. AI Chatbot

Create an interactive AI chatbot.

Allow students to ask questions using text.

Connect the chatbot to the Ollama AI model through the backend.

Display AI responses in a chat interface.

Add loading indicators, timestamps, and chat history.

Handle server errors gracefully.

C. Voice Assistant

Add a microphone button for voice input.

Convert speech into text.

Send the recognized question to the AI assistant.

Convert the AI response into speech.

Include start, stop, and mute controls.

Display helpful messages when microphone permission is denied or voice recognition is unavailable.

D. Student Dashboard

Create a dashboard containing:

Welcome message

AI assistant chat section

Voice assistant controls

College announcements

Timetable and examination information

Attendance information

Campus events

Student profile

Logout button

E. Supabase Integration

Connect the frontend to Supabase using environment variables.

Store student profiles and relevant campus information in PostgreSQL.

Save chat history if required.

Apply Row Level Security (RLS) policies to protect student data.

Ensure students can access only their authorized records.

F. User Interface

Use a professional, colorful, modern college-themed design.

Make the interface responsive on mobile, tablet, and desktop.

Include a sidebar, dashboard cards, icons, and smooth animations.

Provide clear navigation and accessible buttons.

Add dark mode if practical.

4. Security Requirements

Never expose private API keys or Supabase service-role keys in frontend code.

Keep backend secrets in server-side environment variables.

Validate user input on the backend.

Verify Supabase authentication tokens on protected API routes.

Never display passwords or secret keys in error messages.

Handle missing configuration and invalid API keys with clear instructions.

5. Project Structure

Organize the project into separate frontend and backend folders. Use reusable React components, separate CSS files, API routes, authentication logic, and a centralized Supabase client configuration.

Provide an .env.example file with placeholder values. Do not include real secrets.

6. Error Handling and Testing

Fix invalid API key errors.

Fix login and registration failures.

Handle Ollama connection errors.

Verify frontend-to-backend communication.

Test voice input and speech output.

Test Supabase authentication and database access.

Provide clear setup instructions and troubleshooting steps.

7. Deployment

Prepare the application for online deployment. Deploy the frontend and backend to suitable hosting services, configure Supabase, and explain how to host the Ollama model. Do not assume a local Ollama server is accessible from the public internet.

Final Deliverables

Provide:

Complete working source code.

Separate frontend and backend files.

Supabase database schema and security policies.

Environment variable setup instructions.

Step-by-step installation and execution commands.

Testing instructions.

Deployment instructions.

A README file explaining the entire project.

Build the application step by step. Ensure that every feature works, preserve existing working code where possible, and explain each setup step in simple English. Do not use fake authentication or hardcoded AI responses in the final application.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://campus-assistant-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/95c8330e-49d8-5f17-9c44-d45f93020a06).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
