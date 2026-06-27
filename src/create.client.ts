const _store: Record<string, string> = {};
const _localStorage = typeof window !== 'undefined' && window.localStorage
  ? window.localStorage
  : {
      getItem: (key: string): string | null =>
        process.env[key] !== undefined ? process.env[key]! : (_store[key] ?? null),
      setItem: (key: string, value: string): void => {
        process.env[key] = value;
        _store[key] = value;
      },
    };

const DEFAULT_OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434';
const DEFAULT_MODEL           = process.env.OLLAMA_MODEL    || 'qwen3:0.6b';

type Message = { role: string; content: string; [k: string]: any };
type TestResult = { name: string; pass: boolean; output: string[]; error?: string };

function getEndpoint(): string {
  try {
    const raw = _localStorage.getItem('ollama_endpoints');
    const stored = raw ? JSON.parse(raw) : [];
    if (Array.isArray(stored) && stored[0]) return stored[0];
  } catch {}
  return DEFAULT_OLLAMA_ENDPOINT;
}

function getModel(): string {
  return _localStorage.getItem('ollama_default_model') || DEFAULT_MODEL;
}

let _clientModule: any = null;
async function getClientModule(): Promise<any> {
  if (_clientModule) return _clientModule;
  try {
    _clientModule = await import('./apis/client');
    return _clientModule;
  } catch (e: any) {
    throw new Error(`Cannot import ./apis/client — run in browser/Vite context or configure path aliases. (${e?.message || e})`);
  }
}

async function getTestClient(): Promise<any> {
  const { createClient, config } = await getClientModule();
  const client = createClient(config);
  // Use static config as source of truth (it always holds the real remote endpoints).
  // localStorage may hold stale test data (e.g. "http://ep1" from B9) — ignore it.
  const staticEndpoints = config.ollamaEndpoints || [getEndpoint()];
  client.updateConfig({
    model: config.model,
    ollamaEndpoints: [...staticEndpoints],
  });
  return client;
}

function makeRunner() {
  const log: string[] = [];
  const emit = (line: string) => { log.push(line); console.log(line); };
  return { emit, log };
}


const ENTITY_INDEX_MAP: { name: string; defaultIndex: string }[] = [
  { name: 'Persona',                  defaultIndex: 'sample-prompt-persona' },
  { name: 'Template',                 defaultIndex: 'sample-prompt-template' },
];

async function main(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'create client search persona';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(config);

    const personaEntry = client.entities.find((e: any) => e.name === 'Persona');
    if (!personaEntry) throw new Error('Persona entity not found in client.entities');

    // 1. Wildcard search: "Marine*"
    const wildcard = 'Marine*';
    const r1 = await client.esEntities.Persona.filter({ name: wildcard });
    r1.slice(0, 10).forEach((p: any, i: number) => {
    });
    emit(`  ES Persona wildcard search "${wildcard}" → ${r1.length} results `);
    emit(r1);
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// Run main at the end of the file
if (typeof require === 'function' && require.main === module) {
  main().catch(console.error);
}
