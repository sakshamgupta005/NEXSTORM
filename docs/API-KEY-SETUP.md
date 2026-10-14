# Complete Hackathon API Key & Environment Setup Guide

This guide details all supported AI and cloud service providers in the Hackathon Starter, how to manage keys safely, how to verify them without unnecessary costs, and recommended architectural strategies for hackathons.

---

## 1. Quick Start: Setting Up Local Environment

1. Copy the starter environment template:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` in your editor.
3. Fill in **ONLY** the API keys required for your specific hackathon project. Leave unused keys empty.
4. Run the offline diagnostic check to verify what is configured:
   ```bash
   npm run env:check
   ```

> [!IMPORTANT]
> **Secret Hygiene Rules**:
> - Never paste real API keys into chat prompts or commit `.env.local` to GitHub.
> - `.env.local` is strictly ignored by `.gitignore`.
> - Never prefix secret provider keys with `NEXT_PUBLIC_`. Keep all provider API keys server-only.

---

## 2. Billing & Account Credits Notice

> [!CAUTION]
> **Account creation does not guarantee free API access.**
> Many providers require adding a credit card, purchasing prepaid credits, or completing phone verification before API endpoints respond with valid responses (e.g., HTTP 429 Insufficient Quota errors). Always verify your credit balance, spending limits, and rate limits on each provider dashboard before the hackathon begins.

---

## 3. Provider Directory & Verification Guide

### 1. Google Gemini
- **Dashboard**: [https://aistudio.google.com/](https://aistudio.google.com/)
- **Environment Variable**: `GOOGLE_GENERATIVE_AI_API_KEY`
- **Hackathon Use Case**: Extremely large context windows, multimodal analysis (documents, images, audio, video), and rapid prototyping with Gemini models (Flash / Pro).
- **Billing / Credits**: Google AI Studio provides generous free-tier rate limits for developer testing; paid tier requires Google Cloud billing.
- **Status**: Optional.
- **Safe Verification (Header-Based, Minimal Call)**:
  ```bash
  curl https://generativelanguage.googleapis.com/v1beta/models \
    -H "x-goog-api-key: $GOOGLE_GENERATIVE_AI_API_KEY"
  ```
- **Common Mistakes**:
  - Confusing Google Cloud Vertex AI service account JSON keys with Google AI Studio API keys.
  - Exceeding free-tier requests per minute (RPM) limits during live demos without exponential backoff.

---

### 2. OpenAI
- **Dashboard**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Environment Variable**: `OPENAI_API_KEY`
- **Hackathon Use Case**: Industry-standard reasoning (GPT-4o, o1, o3-mini), text embeddings (`text-embedding-3-small`), audio transcription (Whisper), and image generation (DALL-E).
- **Billing / Credits**: Requires prepaid balance or active billing plan. Free accounts have expired credits or low rate limits.
- **Status**: Optional.
- **Safe Verification**:
  ```bash
  curl https://api.openai.com/v1/models \
    -H "Authorization: Bearer $OPENAI_API_KEY"
  ```
- **Common Mistakes**:
  - Assuming ChatGPT Plus subscriptions include API access (they are billed separately).
  - Failing to set project-level spending limits, resulting in unexpected budget cutoffs.

---

### 3. Anthropic Claude
- **Dashboard**: [https://console.anthropic.com/](https://console.anthropic.com/)
- **Environment Variable**: `ANTHROPIC_API_KEY`
- **Hackathon Use Case**: State-of-the-art coding and agentic workflows (Claude 3.5 Sonnet), nuanced reasoning, long document analysis, and high-quality structured JSON outputs.
- **Billing / Credits**: Requires purchasing prepaid credits before API keys will authenticate.
- **Status**: Optional.
- **Safe Verification**:
  ```bash
  # Check models list (minimal metadata fetch)
  curl https://api.anthropic.com/v1/models \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01"
  ```
- **Common Mistakes**:
  - Missing the mandatory `anthropic-version: 2023-06-01` header in direct fetch calls.
  - Setting key on client components; Anthropic enforces strict CORS to prevent browser exposure.

---

### 4. Groq
- **Dashboard**: [https://console.groq.com/](https://console.groq.com/)
- **Environment Variable**: `GROQ_API_KEY`
- **Hackathon Use Case**: Ultra-high-speed inference (500+ tokens/sec) running open models like Llama 3.3 70B, Llama 3 8B, and Mixtral. Ideal for conversational voice bots and interactive UI streaming.
- **Billing / Credits**: Free tier available with generous rate limits; on-demand billing for higher throughput.
- **Status**: Optional.
- **Safe Verification**:
  ```bash
  curl https://api.groq.com/openai/v1/models \
    -H "Authorization: Bearer $GROQ_API_KEY"
  ```
- **Common Mistakes**:
  - Groq uses an OpenAI-compatible API spec; remember to point the base URL to `https://api.groq.com/openai/v1`.

---

### 5. Hugging Face
- **Dashboard**: [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- **Environment Variable**: `HUGGINGFACE_API_KEY`
- **Hackathon Use Case**: Access to hundreds of thousands of open-source models, custom fine-tuned weights, embeddings, domain classifiers, and Serverless Inference Endpoints.
- **Billing / Credits**: Free Serverless Inference API available for popular models with cold-start latency; dedicated Endpoints billed hourly.
- **Status**: Optional.
- **Safe Verification**:
  ```bash
  curl https://huggingface.co/api/whoami-v2 \
    -H "Authorization: Bearer $HUGGINGFACE_API_KEY"
  ```
- **Common Mistakes**:
  - Creating a "Read" token instead of a token with Inference permissions, or relying on serverless inference for models that require dedicated warm instances.

---

### 6. Tavily Search
- **Dashboard**: [https://app.tavily.com/](https://app.tavily.com/)
- **Environment Variable**: `TAVILY_API_KEY`
- **Hackathon Use Case**: Real-time web search purpose-built for AI agents and RAG. Cleans HTML, extracts markdown, and strips clutter before returning context to LLMs.
- **Billing / Credits**: Free tier includes 1,000 search queries per month.
- **Status**: Optional.
- **Safe Verification (Single Test Query)**:
  ```bash
  curl -X POST https://api.tavily.com/search \
    -H "Content-Type: application/json" \
    -d '{"api_key": "'"$TAVILY_API_KEY"'", "query": "test query", "max_results": 1}'
  ```
- **Common Mistakes**:
  - Passing user search queries directly without limiting `max_results` or setting search depth, quickly depleting monthly credits.

---

### 7. ElevenLabs
- **Dashboard**: [https://elevenlabs.io/](https://elevenlabs.io/)
- **Environment Variable**: `ELEVENLABS_API_KEY`
- **Hackathon Use Case**: Ultra-realistic text-to-speech, custom voice cloning, dynamic emotional delivery, and sound effect generation for interactive multimedia demos.
- **Billing / Credits**: Free tier includes 10,000 characters/month (roughly 10 minutes of audio).
- **Status**: Optional.
- **Safe Verification**:
  ```bash
  curl https://api.elevenlabs.io/v1/user \
    -H "xi-api-key: $ELEVENLABS_API_KEY"
  ```
- **Common Mistakes**:
  - Consuming characters rapidly on long paragraphs during local testing. Use small text snippets or cache audio responses locally.

---

### 8. Supabase
- **Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
- **Environment Variables**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
  - `SUPABASE_SERVICE_ROLE_KEY` *(Optional, Server-only)*
- **Hackathon Use Case**: Hosted PostgreSQL database, row-level security (RLS), user authentication, file storage buckets, and `pgvector` for similarity search.
- **Billing / Credits**: Generous free tier includes 2 free active projects and 500MB database storage.
- **Status**: Optional (the starter renders safely in mock preview if unconfigured).
- **Safe Verification**:
  ```bash
  curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  ```
- **Common Mistakes**:
  - Prefixing `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`, which would leak database administrator privileges to client browsers.
  - Forgetting to add redirect URLs under **Authentication** -> **URL Configuration** in the Supabase dashboard.

---

## 4. Hackathon Provider Selection Strategy

Avoid the temptation to integrate every provider at once. Follow this lean strategy:

```
                      Problem Statement
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       Core Reasoning                 Specialized Needs
  Choose ONE Primary LLM:                     │
  - Deep logic / code: Claude 3.5 Sonnet      ├── Web search? ──> Tavily
  - Multimodal / large docs: Gemini 2.5       ├── Voice output? ──> ElevenLabs
  - General / structured outputs: GPT-4o      ├── Open-source / niche? ──> Hugging Face
  - Speed / voice agents: Groq (Llama 3)      └── Relational / Auth? ──> Supabase
```

1. **Primary LLM**: Pick **one** provider based on your available credits, latency requirements, and model strengths.
2. **Fallback LLM**: Implement a secondary provider only if you encounter rate limits or reliability issues during live judging.
3. **Web Search**: Add Tavily only if the product requires real-time factual retrieval (e.g., news, competitor research).
4. **Voice Generation**: Add ElevenLabs only if an audible voice interface is a judging requirement.
5. **Database & Persistence**: Activate Supabase when user state, history, or relational data must survive between browser refreshes.

---

## 5. Diagnostic Command Reference

Check the status of your local environment at any time:

```bash
# Inspect all configured and missing keys (masks values completely)
npm run env:check
```
