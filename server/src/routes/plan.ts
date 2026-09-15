import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { generateTrainingPlan } from "../lib/ai";

export const planRouter = Router();

planRouter.post("/generate", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    console.log("[PLAN] Generating plan for user:", userId);

    // Get the user's saved onboarding/profile data
    const profile = await prisma.user_profiles.findUnique({
      where: {
        user_id: userId,
      },
    });

    if (!profile) {
      return res.status(400).json({
        error: "User profile not found. Complete onboarding first.",
      });
    }

    console.log("[PLAN] Profile found");

    // Get the latest plan so we can increment the version
    const latestPlan = await prisma.training_plans.findFirst({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        version: true,
      },
    });

    const nextVersion = latestPlan
      ? latestPlan.version + 1
      : 1;

    console.log("[PLAN] Creating version:", nextVersion);

    let planJson;

    try {
      planJson = await generateTrainingPlan(profile);

      console.log("[PLAN] AI plan generated successfully");
    } catch (error) {
      console.error("[PLAN] AI generation failed:", error);

      return res.status(500).json({
        error: "Failed to generate training plan. Please try again.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    }

    const planText = JSON.stringify(planJson, null, 2);

    // Save the newly generated plan
    const newPlan = await prisma.training_plans.create({
      data: {
        user_id: userId,
        plan_json: planJson as any,
        plan_text: planText,
        version: nextVersion,
      },
    });

    console.log(
      "[PLAN] Plan saved successfully:",
      newPlan.id,
    );

    // IMPORTANT:
    // Return the complete plan instead of only id/version/date.
    res.status(200).json({
      id: newPlan.id,
      userId: newPlan.user_id,
      planJson: newPlan.plan_json,
      planText: newPlan.plan_text,
      version: newPlan.version,
      createdAt: newPlan.created_at,
    });
  } catch (error) {
    console.error("[PLAN] Error generating plan:", error);

    res.status(500).json({
      error: "Failed to generate plan",
      details:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
});

planRouter.get("/current", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    const plan = await prisma.training_plans.findFirst({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!plan) {
      return res.status(404).json({
        error: "No plan found",
      });
    }

    res.status(200).json({
      id: plan.id,
      userId: plan.user_id,
      planJson: plan.plan_json,
      planText: plan.plan_text,
      version: plan.version,
      createdAt: plan.created_at,
    });
  } catch (error) {
    console.error("Error fetching plan:", error);

    res.status(500).json({
      error: "Failed to fetch plan",
    });
  }
});