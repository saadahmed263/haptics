import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export const runtime = 60;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const cadAnalysisSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    objectCategory: { type: SchemaType.STRING },
    estimatedMassGrams: { type: SchemaType.NUMBER },
    userIntentContext: {
      type: SchemaType.STRING,
      description: "Briefly restate what context was used from the user's description. SENTENCE CASE.",
    },
    primaryVerdictHeading: {
      type: SchemaType.STRING,
      description: "Brutal and direct caps-driven ergonomic assessment. Declare: 'FATAL ERGONOMIC FLAW' or 'ERGONOMICALLY OPTIMAL'.",
    },
    primaryVerdictBody: {
      type: SchemaType.STRING,
      description: "Reasoning for the verdict. SENTENCE CASE. Prioritize the human functional consequence.",
    },
    suggestedJunkSimulations: {
      type: SchemaType.STRING,
      description: "Functional assembly instructions for creating a balanced physical proxy model. Reference items by their sequential number in the highlights. SENTENCE CASE.",
    },
    assemblyHighlights: {
      type: SchemaType.ARRAY,
      description: "A sequential map of pins. IF NO IMAGE IS PROVIDED, RETURN AN EMPTY ARRAY [].",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          xPercent: { type: SchemaType.NUMBER }, 
          yPercent: { type: SchemaType.NUMBER },
          label: { type: SchemaType.STRING },
          hexColor: { type: SchemaType.STRING },
        },
        required: ["xPercent", "yPercent", "label", "hexColor"],
      },
    },
    volumeCm3: { type: SchemaType.NUMBER },
    visibleMaterial: { type: SchemaType.STRING },
    confidence: { type: SchemaType.NUMBER },
  },
  required: ["objectCategory", "estimatedMassGrams", "userIntentContext", "primaryVerdictHeading", "primaryVerdictBody", "suggestedJunkSimulations", "assemblyHighlights", "volumeCm3", "visibleMaterial", "confidence"],
};

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, userDescription, exactMass } = await req.json();

    if (!imageBase64 && (!exactMass || !userDescription)) {
      return NextResponse.json({ error: 'Missing payload. Require image OR exact mass + description.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1, 
        responseMimeType: "application/json",
        responseSchema: cadAnalysisSchema,
      },
      systemInstruction: `You are an elite industrial engineer and ergonomist.
      1. If an image is provided, calculate digital mass based on it. If an exact mass is provided, USE THAT MASS directly.
      2. Use the user's description (chat box) to understand intent. Declare an 'ERGONOMIC FAILURE' in primaryVerdictHeading if it sags or causes pain.
      3. Suggest assembly strategies prioritizing center of gravity.
      4. If an image is provided, create a sequential, numbered JSON array of visual highlights for standard junk simulation using image pixels. IF NO IMAGE IS PROVIDED, return an empty array [] for assemblyHighlights.
      5. Reference only generic metric/Asian household items.
      6. Sentence case all body text; caps only for verdicts.`
    });

    const promptParts: any[] = [];
    
    if (imageBase64 && mimeType) {
        promptParts.push(`User description: "${userDescription || 'None'}". Analyze this design.`);
        promptParts.push({ inlineData: { data: imageBase64, mimeType } });
    } else {
        promptParts.push(`User explicitly defined the mass as ${exactMass} grams. User description of the object: "${userDescription}". Provide ergonomic assessment and proxy assembly instructions.`);
    }

    const result = await model.generateContent(promptParts);
    const responseText = result.response.text();
    if (!responseText) throw new Error("Model returned empty response.");
    const analysisData = JSON.parse(responseText);

    return NextResponse.json({ success: true, data: analysisData }, { status: 200 });
  } catch (error: any) {
    console.error('[CAD_ANALYSIS_ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
