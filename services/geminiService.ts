/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

/**
 * Generates a grid of images showing the base model from all sides.
 * @param baseImage The file for the base house structure.
 * @returns A promise that resolves to an object containing the base64 data URL of the generated image grid.
 */
export const generateBaseModelViews = async (
    baseImage: File
): Promise<{ finalImageUrl: string; }> => {
    console.log('Starting base model view generation...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const prompt = `You are an expert architectural visualizer. Based on the provided image of an L-shaped modular home, create a single, cohesive image displaying photorealistic renders of the structure from multiple key angles: front, rear, and both sides. Arrange these four views in a clean 2x2 grid.

**Style & Climate:** The design should be a modern tropical style suitable for the Philippines.

**Rendering & Materials:**
- **Lighting:** Use realistic lighting for a bright, slightly overcast tropical day to produce soft shadows and avoid harsh glare. Include subtle ambient occlusion for depth.
- **Materials:** Render materials with realistic properties. Glass surfaces must be clearly reflective, and metal elements should have a slight sheen.
- **Background:** Each view must have a simple, neutral gray background.

**Output:** The final output must be ONLY the generated 2x2 grid image, with no text or labels.`;

    const baseImagePart = await fileToPart(baseImage);
    const textPart = { text: prompt };

    console.log('Sending request to Gemini for base model views...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [baseImagePart, textPart] },
        config: { responseModalities: [Modality.IMAGE] },
    });

    console.log('Received response from Gemini for base model views.');
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        const finalImageUrl = `data:${mimeType};base64,${data}`;
        return { finalImageUrl };
    }

    console.error("Model response did not contain an image part for base views.", response);
    throw new Error("The AI model did not return an image for the base model views.");
};

/**
 * Generates one or more modified house images based on a base image and a descriptive prompt.
 * @param baseImage The file for the base house structure.
 * @param prompt A detailed text description of the desired modifications.
 * @param variationCount The number of design variations to generate.
 * @returns A promise that resolves to an object containing an array of base64 data URLs for the generated images.
 */
export const generateHouseImage = async (
    baseImage: File, 
    prompt: string,
    variationCount: number
): Promise<{ finalImageUrls: string[]; }> => {
  console.log(`Starting image generation process for ${variationCount} variations...`);
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

  const baseImagePart = await fileToPart(baseImage);

  // Create an array of promises for concurrent generation
  const generationPromises = Array.from({ length: variationCount }).map((_, index) => {
    // Add a variation request to the prompt to encourage diversity
    const variationPrompt = variationCount > 1 
      ? `${prompt}\n\n**Variation Instruction:** Generate a unique, creative variation based on the above criteria. Show a different interpretation.`
      : prompt;
    const textPart = { text: variationPrompt };
    
    console.log(`Sending request to Gemini for variation ${index + 1}...`);
    return ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [baseImagePart, textPart] },
      config: { responseModalities: [Modality.IMAGE] },
    });
  });

  const responses = await Promise.all(generationPromises);
  console.log('Received all responses from Gemini.');

  const finalImageUrls = responses.map((response, index) => {
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    if (imagePartFromResponse?.inlineData) {
      const { mimeType, data } = imagePartFromResponse.inlineData;
      console.log(`Received image data for variation ${index + 1}`);
      return `data:${mimeType};base64,${data}`;
    }
    console.error(`Model response did not contain an image part for variation ${index + 1}.`, response);
    throw new Error(`The AI model did not return an image for variation ${index + 1}.`);
  });

  if (finalImageUrls.length !== variationCount) {
    throw new Error("The number of generated images did not match the requested count.");
  }

  return { finalImageUrls };
};