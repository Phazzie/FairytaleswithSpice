# Fairytales with Spice: AI-Powered Story Generator

**Fairytales with Spice** is an innovative platform that uses generative AI to create spicy, adult-themed fairy tales. Built with a unique "Seam-Driven Development" methodology, this project ensures robust, maintainable, and easily-extendable code.

## ✨ Key Features

- **AI-Powered Story Generation**: Create unique stories based on creature types, themes, and user-defined prompts.
- **Spicy Content Rating**: Control the intensity of the story with a 1-5 spicy level rating system.
- **Multi-Modal Experience**: Convert generated stories into audio narration.
- **Multiple Export Formats**: Save your favorite stories in various formats, including PDF, TXT, and EPUB.
- **Chapter Continuation**: Extend your stories with new chapters that maintain the original tone and style.
- **Mock-First Development**: Fully functional development environment without the need for external API keys.

## 🏗️ Architecture: Seam-Driven Development

This project follows a strict **Seam-Driven Development** methodology. This means that every data boundary (or "seam") between components is explicitly defined with TypeScript contracts *before* any implementation is written. This approach prevents integration issues and allows for a clear separation of concerns.

The core idea is to define the `input` and `output` of each service interaction, ensuring that the frontend and backend are always in sync. You can find these contracts in the `story-generator/src/app/contracts.ts` and `backend/src/types/contracts.ts` files.

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Angular CLI](https://angular.io/cli) (v17 or higher)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/FairytaleswithSpice.git
    cd FairytaleswithSpice
    ```

2.  **Install backend dependencies:**
    ```bash
    cd backend
    npm install
    ```

3.  **Install frontend dependencies:**
    ```bash
    cd ../story-generator
    npm install
    ```

### Running the Application

1.  **Set up environment variables:**

    Create a `.env` file in the `backend` directory by copying the `.env.example` file:
    ```bash
    cp backend/.env.example backend/.env
    ```

    Update the `backend/.env` file with your API keys if you want to use the real AI services. Otherwise, the application will run in mock mode by default.

    ```
    # .env
    NODE_ENV=development
    PORT=3001
    FRONTEND_URL=http://localhost:4200

    # Optional: Add your API keys to use real AI services
    XAI_API_KEY=your_grok_key
    ELEVENLABS_API_KEY=your_elevenlabs_key
    ```

2.  **Start the backend server:**
    ```bash
    cd backend
    npm run dev
    ```
    The backend server will be running at `http://localhost:3001`.

3.  **Start the frontend server:**
    ```bash
    cd ../story-generator
    npm start
    ```
    The frontend application will be running at `http://localhost:4200`.

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.