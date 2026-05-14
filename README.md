# Dynamic Settings Extension for Pi

Per-mode sampling parameters (temperature, top_p, etc.) injected into every
provider request — no model reload needed. Pi continues to function as a full
agent harness: all tools active, system prompt unchanged, AGENTS.md respected.

All params live in a sidecar JSON file so they can be tuned without editing code.

## Install

```bash
mkdir -p ~/.pi/agent/extensions/pi-dynamic-settings
cp index.ts config.json ~/.pi/agent/extensions/pi-dynamic-settings/
```

Then restart Pi or run `/reload`.

## Usage

```
/dynamic-settings         Show mode selector
/dynamic-settings off     Disable, restore provider defaults
/dynamic-settings <name>  Switch to a named mode
```

### Modes

| Mode | Temperature | Top_P | Description |
|------|-------------|-------|-------------|
| `creative` | 1.1 | 0.95 | High creativity, varied output |
| `focused` | 0.3 | 0.90 | Deterministic, precise |
| `balanced` | 0.7 | 0.95 | General-purpose balance |
| `precise` | 0.6 | 0.95 | Structured, low variance |

## Tuning

Edit `config.json` to customize or add modes:

```json
{
  "modes": {
    "creative": {
      "temperature": 1.1,
      "top_p": 0.95,
      "top_k": 20,
      "min_p": 0.0,
      "presence_penalty": 0.1,
      "frequency_penalty": 0.05,
      "repetition_penalty": 1.0
    },
    "my-mode": {
      "temperature": 0.8,
      "top_p": 0.95,
      "top_k": 20,
      "min_p": 0.0,
      "presence_penalty": 0.0,
      "frequency_penalty": 0.0,
      "repetition_penalty": 1.0
    }
  }
}
```

- **Param changes** apply immediately on next message (read fresh each request)

### Supported Parameters

**Standard (all OpenAI-compatible backends):**
- `temperature` — randomness (0.0 = deterministic, 1.0+ = creative)
- `top_p` — nucleus sampling cutoff (0.0–1.0)
- `top_k` — keep only top K tokens per step (0 = disabled)
- `min_p` — minimum token probability ratio (0.0–1.0)
- `presence_penalty` — penalize tokens that already appear (-2.0 to 2.0)
- `frequency_penalty` — penalize tokens proportional to frequency (-2.0 to 2.0)
- `repetition_penalty` — curvature penalty on repeated tokens (1.0 = disabled)

**llama.cpp-specific (passed through, may not work on all backends):**
- `repeat_last_n` — window for repetition penalty
- `dry_multiplier`, `dry_base`, `dry_allowed_length`, `dry_penalty_last_n` — DRY sampling
- `xtc_probability`, `xtc_threshold` — XTC sampling
- `typ_p` — typical sampling
- `tfs_z` — tail-free sampling

Any extra fields in the JSON are passed through to the provider payload.
Backends that don't recognize them will silently ignore them.

## Differences from pi-dynamic-chat

| | pi-dynamic-chat | pi-dynamic-settings |
|---|---|---|
| System prompt | Replaced with mode prompt | Unchanged |
| Tools | Bash disabled, file tools only | All tools active |
| AGENTS.md | Not loaded | Respected normally |
| Custom mode | Yes (user provides prompt) | No |
| Purpose | Step away from agent harness | Warmer creativity, full agent |

## How It Works

Sampling parameters are injected via the `before_provider_request` extension
event. This fires after Pi builds the provider-specific payload but before the
HTTP request is sent. The handler adds/overrides fields in the payload object,
which are then serialized and sent to the backend.

This means:
- **Per-request application** — params change instantly, no model reload
- **Backend-agnostic** — works with any OpenAI-compatible backend (llama.cpp, Ollama, LM Studio, etc.)
- **Graceful degradation** — unknown params are silently ignored by backends that don't support them

## References

- [Qwen 3.6 27B sampling recommendations](https://qwenlm.github.io/)
- [llama.cpp API documentation](https://github.com/ggml-org/llama.cpp)
- [Pi extensions docs](https://github.com/nicepkg/pi-coding-agent/blob/main/docs/extensions.md)
