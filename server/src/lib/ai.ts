import OpenAI from "openai";
import dotenv from "dotenv";
import { TrainingPlan, UserProfile } from "../../types";

dotenv.config();

export async function generateTrainingPlan(
  profile: UserProfile | Record<string, any>,
): Promise<Omit<TrainingPlan, "id" | "userId" | "version" | "createdAt">> {
  const normalizedProfile: UserProfile = {
    goal: profile.goal || "bulk",
    experience: profile.experience || "intermediate",
    days_per_week: profile.days_per_week || 4,
    session_length: profile.session_length || 60,
    equipment: profile.equipment || "full_gym",
    injuries: profile.injuries || null,
    preferred_split: profile.preferred_split || "upper_lower",
  };

  const apiKey = process.env.OPEN_ROUTER_KEY;

  if (!apiKey) {
    throw new Error("OPEN_ROUTER_KEY is not set in environment variables");
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",

    // Keep these values simple ASCII strings.
    // This avoids the ByteString error you previously had on Vercel.
    defaultHeaders: {
      "HTTP-Referer": "https://gym-ai-beige.vercel.app",
      "X-Title": "GymAI Plan Generator",
    },
  });

  const prompt = buildPrompt(normalizedProfile);

  try {
    console.log("[AI] Starting OpenRouter request...");

    const completion = await openai.chat.completions.create(
      {
        // OpenRouter automatically selects an available
        // free model that supports chat completion.
        model: "openrouter/free",

        messages: [
          {
            role: "system",
            content:
  "You are an expert fitness trainer and program designer. " +
  "Return ONLY a valid JSON object matching the requested schema. " +
  "Do not use markdown. Do not use code fences. " +
  "Do not write explanations before or after the JSON. " +
  "The first character of your response must be { " +
  "and the last character must be }.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],

        temperature: 0.7,
      },
      {
        // Prevent the request from hanging indefinitely.
        timeout: 60000,
      },
    );

    console.log("[AI] OpenRouter request completed");

    console.log(
      "[AI] OpenRouter response:",
      JSON.stringify(completion, null, 2),
    );

    // Safely access choices.
    // Previously completion.choices[0] caused:
    // "Cannot read properties of undefined (reading '0')"
    const content = completion?.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[AI] No usable content in OpenRouter response");

      throw new Error(
        `AI returned no usable content. Response: ${JSON.stringify(
          completion,
        )}`,
      );
    }

    console.log("[AI] Response received successfully");

    let planData: any;

    try {
      planData = parseAIJson(content);
    } catch (error) {
      console.error("[AI] Failed to parse AI response as JSON:");
      console.error("[AI] Raw response:");
      console.error(content);

      throw new Error("AI returned invalid JSON");
    }

    return formatPlanResponse(planData, normalizedProfile);
  } catch (error) {
    console.error("[AI] Error generating training plan:", error);
    throw error;
  }
}

function buildPrompt(profile: UserProfile): string {
  return `
Create a personalized weekly gym training plan based on the following user profile.

USER PROFILE:

Goal: ${profile.goal}
Experience: ${profile.experience}
Days per week: ${profile.days_per_week}
Session length: ${profile.session_length} minutes
Equipment: ${profile.equipment}
Injuries: ${profile.injuries || "None"}
Preferred split: ${profile.preferred_split}

REQUIREMENTS:

1. Create exactly ${profile.days_per_week} training days.

2. Each training day must contain between 4 and 6 exercises.

3. The plan must be appropriate for the user's:
   - Goal
   - Experience level
   - Available equipment
   - Number of training days
   - Session length
   - Injuries

4. Follow the user's preferred split when possible.

5. Include appropriate sets, reps, rest periods, and RPE.

6. RPE should generally be between 6 and 9.

7. Avoid exercises that could aggravate the user's listed injuries.

8. Make the weekly schedule realistic and balanced.

9. Include useful program notes explaining how the user should approach the overall program.

10. Include a progression strategy explaining how the user should increase
    weight, repetitions, or difficulty over time.

11. Return ONLY valid JSON.
    
Use EXACTLY this JSON structure:

{
  "overview": {
    "goal": "string",
    "frequency": "string",
    "split": "string",
    "notes": "string"
  },

  "weeklySchedule": [
    {
      "day": "string",
      "focus": "string",
      "exercises": [
        {
          "name": "string",
          "sets": number,
          "reps": "string",
          "rest": "string",
          "rpe": number,
          "notes": "string"
        }
      ]
    }
  ],

  "progression": {
    "method": "string",
    "guidelines": [
      "string"
    ]
  }
}

IMPORTANT:

- "goal" should describe the user's training goal.
- "frequency" should describe how often they train, for example "4 days per week".
- "split" should describe the training split, for example "Upper / Lower".
- "notes" should be a useful paragraph about the overall training program.
- "method" should describe the progression method.
- "guidelines" should contain multiple practical progression instructions.
- Every exercise must have sets, reps, rest, RPE, and notes.
- Do not use markdown.
- Do not use code fences.
- Do not write anything before or after the JSON.
- The first character of your response must be {.
- The last character of your response must be }.
`;
}
function parseAIJson(content: string): any {
  let cleaned = content.trim();

  // Remove markdown code fences.
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // First attempt: the response is already valid JSON.
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with extraction below.
  }

  // Sometimes the model adds text before/after the JSON.
  // Find the first { and the last }.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonText = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(jsonText);
    } catch {
      // Continue to the final error.
    }
  }

  throw new Error("Unable to parse AI response as JSON");
}

function formatPlanResponse(
  planData: any,
  profile: UserProfile,
): Omit<TrainingPlan, "id" | "userId" | "version" | "createdAt"> {
  return {
    overview: {
      goal:
        planData?.overview?.goal ||
        profile.goal,

      frequency:
        planData?.overview?.frequency ||
        `${profile.days_per_week} days per week`,

      split:
        planData?.overview?.split ||
        profile.preferred_split,

      notes:
        planData?.overview?.notes ||
        `This ${profile.days_per_week}-day training program is designed for your ${profile.goal} goal. Focus on maintaining good exercise technique, completing the prescribed repetitions, and recovering adequately between sessions.`,
    },

    weeklySchedule:
      Array.isArray(planData?.weeklySchedule)
        ? planData.weeklySchedule
        : [],

    progression: {
      method:
        planData?.progression?.method ||
        "Progressive overload",

      guidelines:
        Array.isArray(planData?.progression?.guidelines)
          ? planData.progression.guidelines
          : [
              "Increase weight gradually when you can complete all prescribed repetitions with good form.",
              "Keep most working sets within the prescribed RPE range.",
              "Prioritize proper technique over adding weight.",
            ],
    },
  };
}