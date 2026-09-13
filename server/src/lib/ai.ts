import OpenAI from "openai";
import dotenv from "dotenv";
import { TrainingPlan, UserProfile } from "../../types";

dotenv.config();

export async function generateTrainingPlan(
  profile: UserProfile | Record<string, any>,
): Promise<Omit<TrainingPlan, "id" | "userId" | "version" | "createdAt">> {
  // Normalize profile data
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
    defaultHeaders: {
      "HTTP-Referer": process.env.BASE_URL || "http://localhost:3001",
      "X-Title": "GymAI Plan Generator",
    },
  });

  // Build the prompt
  const prompt = buildPrompt(normalizedProfile);

  try {
    const completion = await openai.chat.completions.create({
      // Changed from embedding model to chat/reasoning model
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",

      messages: [
        {
          role: "system",
          content:
            "You are an expert fitness trainer and program designer. You must respond with valid JSON only. Do not include markdown, code fences, explanations, reasoning, or any additional text outside the JSON object.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      console.error(
        "[AI] No content in response:",
        JSON.stringify(completion, null, 2),
      );

      throw new Error("No content in AI response");
    }

    console.log("[AI] Response received successfully");

    let planData;

    try {
      planData = JSON.parse(content);
    } catch (parseError) {
      console.error("[AI] Failed to parse AI response as JSON:");
      console.error(content);

      throw new Error("AI returned invalid JSON");
    }

    return formatPlanResponse(planData, normalizedProfile);
  } catch (error) {
    console.error("[AI] Error generating training plan:", error);
    throw error;
  }
}

function formatPlanResponse(
  aiResponse: any,
  profile: UserProfile,
): Omit<TrainingPlan, "id" | "userId" | "version" | "createdAt"> {
  const plan: Omit<
    TrainingPlan,
    "id" | "userId" | "version" | "createdAt"
  > = {
    overview: {
      goal:
        aiResponse.overview?.goal ||
        `Customized ${profile.goal} program`,

      frequency:
        aiResponse.overview?.frequency ||
        `${profile.days_per_week} days per week`,

      split:
        aiResponse.overview?.split ||
        profile.preferred_split,

      notes:
        aiResponse.overview?.notes ||
        "Follow the program consistently for best results.",
    },

    weeklySchedule: (aiResponse.weeklySchedule || []).map((day: any) => ({
      day: day.day || "Day",

      focus:
        day.focus ||
        "Full Body",

      exercises: (day.exercises || []).map((ex: any) => ({
        name:
          ex.name ||
          "Exercise",

        sets:
          ex.sets ||
          3,

        reps:
          ex.reps ||
          "8-12",

        rest:
          ex.rest ||
          "60-90 sec",

        rpe:
          ex.rpe ||
          7,

        notes:
          ex.notes,

        alternatives:
          ex.alternatives,
      })),
    })),

    progression:
      aiResponse.progression ||
      "Increase weight by 2.5-5lbs when you can complete all sets with good form. Track your progress weekly.",
  };

  return plan;
}

function buildPrompt(profile: UserProfile): string {
  const goalMap: Record<string, string> = {
    bulk: "build muscle and gain size",
    cut: "lose fat and maintain muscle",
    recomp: "simultaneously lose fat and build muscle",
    strength: "build maximum strength",
    endurance: "improve cardiovascular endurance and stamina",
  };

  const experienceMap: Record<string, string> = {
    beginner: "beginner (0-1 years of training experience)",
    intermediate: "intermediate (1-3 years of training experience)",
    advanced: "advanced (3+ years of training experience)",
  };

  const equipmentMap: Record<string, string> = {
    full_gym: "full gym access with all equipment",
    home: "home gym with limited equipment",
    dumbbells: "only dumbbells available",
  };

  const splitMap: Record<string, string> = {
    full_body: "full body workouts",
    upper_lower: "upper/lower split",
    ppl: "push/pull/legs split",
    custom: "best split for their goals",
  };

  return `Create a personalized ${profile.days_per_week}-day per week training plan for someone with the following profile:

Goal: ${goalMap[profile.goal] || profile.goal}
Experience Level: ${experienceMap[profile.experience] || profile.experience}
Session Length: ${profile.session_length} minutes per session
Equipment: ${equipmentMap[profile.equipment] || profile.equipment}
Preferred Split: ${splitMap[profile.preferred_split] || profile.preferred_split}
${profile.injuries ? `Injuries/Limitations: ${profile.injuries}` : ""}

Generate a complete training plan in JSON format with this exact structure:

{
  "overview": {
    "goal": "brief description of the training goal",
    "frequency": "X days per week",
    "split": "training split name",
    "notes": "important notes about the program (2-3 sentences)"
  },
  "weeklySchedule": [
    {
      "day": "Monday",
      "focus": "muscle group or focus area",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 4,
          "reps": "6-8",
          "rest": "2-3 min",
          "rpe": 8,
          "notes": "form cues or tips",
          "alternatives": [
            "Alternative 1",
            "Alternative 2"
          ]
        }
      ]
    }
  ],
  "progression": "detailed progression strategy (2-3 sentences explaining how to progress)"
}

Requirements:

- Create exactly ${profile.days_per_week} workout days.
- Each workout must fit within ${profile.session_length} minutes.
- Include 4-6 exercises per workout.
- RPE must be between 6 and 9.
- Include compound movements for beginners and intermediate lifters.
- Advanced lifters can have more isolation exercises.
- Match the preferred split: ${profile.preferred_split}.
- ${
    profile.injuries
      ? `Avoid exercises that could aggravate: ${profile.injuries}.`
      : ""
  }
- Provide exercise alternatives where appropriate.
- Make the program progressive.
- Make the program appropriate for the user's experience level.
- Do not create more workout days than requested.
- Do not include explanations outside the JSON object.

IMPORTANT:

Return ONLY a valid JSON object.

Do NOT wrap the JSON in markdown.
Do NOT use \`\`\`json.
Do NOT write "Here is your plan".
Do NOT include any text before or after the JSON.
`;
}