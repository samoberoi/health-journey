import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, meal_type } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a clinical food nutrition analyst. Analyze the food in the image and estimate calories.
Return a JSON object using this exact tool/function call format.
IMPORTANT: Use USDA FoodData Central / standard nutritional database values for calorie estimation — do NOT inflate.
Examples: 1 medium banana = 89 kcal, 1 medium apple = 95 kcal, 1 whole egg = 72 kcal, 1 cup cooked rice = 206 kcal.
Estimate portion sizes carefully from visual cues. When uncertain, lean toward conservative (lower) estimates.
For Indian food, use standard single-serving sizes (e.g., 1 roti = 70-80 kcal, 1 cup dal = 180 kcal).
If you cannot identify the food clearly, make your best estimate and note uncertainty.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${image_base64}` },
              },
              {
                type: "text",
                text: `This is my ${meal_type === "lmod" ? "last meal" : "first meal"} of the day. Analyze the food items and estimate calories for each item and total.`,
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_food_analysis",
              description: "Report the food items detected and their estimated calories",
              parameters: {
                type: "object",
                properties: {
                  food_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Name of the food item" },
                        portion: { type: "string", description: "Estimated portion size" },
                        calories: { type: "number", description: "Estimated calories" },
                      },
                      required: ["name", "portion", "calories"],
                    },
                  },
                  total_calories: { type: "number", description: "Total estimated calories for the meal" },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Confidence in the estimate",
                  },
                  notes: { type: "string", description: "Any notes about the estimation" },
                },
                required: ["food_items", "total_calories", "confidence"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_food_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No analysis returned from AI");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-food error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
