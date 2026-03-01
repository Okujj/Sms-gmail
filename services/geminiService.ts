
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, MarketInsights } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class GeminiService {
  private getClient() {
    // Guidelines: Create a new instance right before making an API call 
    // to ensure it uses the most up-to-date API key.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // Use gemini-3-pro-preview for complex reasoning tasks involving market analysis and lead discovery
  // We use a two-step approach to strictly follow the guidelines regarding Google Search grounding and JSON parsing.
  async searchLeads(query: string, product: string, retryCount = 0): Promise<{ leads: Lead[], insights: MarketInsights }> {
    const ai = this.getClient();
    try {
      // Step 1: Research with Google Search grounding
      // Guidelines: If Google Search is used, you MUST ALWAYS extract the URLs from groundingChunks and list them.
      // Guidelines: For search-grounded queries, do not attempt to parse response.text as JSON.
      const researchResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Analise profundamente o mercado global para o produto: "${product}" e identifique tendências no nicho "${query}". 
        Localize potenciais leads (nome e Gmail) baseados em perfis públicos reais ou comportamentos de mercado.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      // Extract grounding URLs as per requirements
      const groundingChunks = researchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Fonte de Pesquisa',
        uri: chunk.web?.uri
      })).filter((s: any) => s.uri) || [];

      // Step 2: Format the research data into structured JSON using a non-grounded call
      const jsonResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Com base nos seguintes dados de pesquisa de mercado, extraia as informações no formato JSON solicitado.
        
        DADOS DE PESQUISA:
        ${researchResponse.text}
        
        INSTRUÇÕES:
        1. Identifique os 5 países principais.
        2. Forneça uma análise resumida (rationale).
        3. Liste pelo menos 20 leads (nome e email) baseados nos dados coletados.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.OBJECT,
                properties: {
                  topCountries: { type: Type.ARRAY, items: { type: Type.STRING } },
                  rationale: { type: Type.STRING },
                  trendScore: { type: Type.NUMBER }
                },
                required: ["topCountries", "rationale"]
              },
              leads: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    email: { type: Type.STRING },
                    ageRange: { type: Type.STRING },
                    source: { type: Type.STRING }
                  },
                  required: ["name", "email"]
                }
              }
            },
            required: ["insights", "leads"]
          }
        }
      });

      // Directly access .text property from response as per guidelines
      const data = JSON.parse(jsonResponse.text || '{}');
      
      const leads = (data.leads || []).map((l: any, index: number) => ({
        id: `lead-${Date.now()}-${index}`,
        name: l.name,
        email: l.email,
        ageRange: l.ageRange || "Desconhecido",
        status: 'new',
        source: l.source || "Market Research"
      }));

      return {
        leads,
        insights: {
          ...(data.insights || { topCountries: [], rationale: "Dados indisponíveis", trendScore: 0 }),
          sources
        }
      };
    } catch (error: any) {
      if ((error.status === 429 || error.message?.includes('429')) && retryCount < 2) {
        await delay(2000 * (retryCount + 1));
        return this.searchLeads(query, product, retryCount + 1);
      }
      console.error("Error searching leads:", error);
      throw error;
    }
  }

  // Use gemini-3-pro-preview for logic and validation tasks
  async validateLead(lead: Lead, targetAgeRange: string, retryCount = 0): Promise<{ isValid: boolean; notes: string }> {
    const ai = this.getClient();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Valide se o lead ${lead.name} (${lead.email}) se encaixa na faixa etária desejada: ${targetAgeRange}. 
        Considere o contexto do email e nome. Se não for possível ter certeza, faça uma estimativa lógica.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isValid: { type: Type.BOOLEAN },
              notes: { type: Type.STRING }
            },
            required: ["isValid", "notes"]
          }
        }
      });

      // Directly access .text property from response
      return JSON.parse(response.text || '{"isValid": false, "notes": "Erro na validação"}');
    } catch (error: any) {
      if ((error.status === 429 || error.message?.includes('429')) && retryCount < 2) {
        await delay(1000 * (retryCount + 1));
        return this.validateLead(lead, targetAgeRange, retryCount + 1);
      }
      console.error("Error validating lead:", error);
      return { isValid: false, notes: "Erro de conexão com AI" };
    }
  }

  // Use gemini-3-pro-preview for high-quality persuasive content generation
  async generatePersonalizedMessage(lead: Lead, link: string, template: string): Promise<string> {
    const ai = this.getClient();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Escreva um e-mail curto e persuasivo para ${lead.name}. 
        Use este template como base: "${template}". 
        Inclua este link: ${link}. 
        O tom deve ser amigável e profissional.`,
      });

      // Directly access .text property from response
      return response.text || "";
    } catch (error) {
      return template.replace("{name}", lead.name).replace("{link}", link);
    }
  }
}

export const geminiService = new GeminiService();
