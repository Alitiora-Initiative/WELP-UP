from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"

MIN_TRADE_SOL = Decimal("0.001")
MIN_ACCOUNT_USD = Decimal("0.50")
CONFIDENCE_FLOOR = Decimal("80")
CONFIDENCE_CEILING = Decimal("98")
ARM_PHRASE = "TRADE-LIVE"

# Quote assets we accept on the chart side. Execution is always SOL <-> token.
STABLE_MINTS = {USDC_MINT, USDT_MINT}
QUOTE_MINTS = STABLE_MINTS | {SOL_MINT}

STOCK_QUERIES = (
    "AAPLx",
    "MSFTx",
    "NVDAx",
    "GOOGLx",
    "AMZNx",
    "METAx",
    "TSLAx",
    "COINx",
    "HOODx",
    "MCDx",
    "CRCLx",
    "PLTRx",
    "AVGOx",
    "NFLXx",
    "AMDx",
    "INTCx",
    "BACx",
    "JPMx",
    "XOMx",
    "SPYx",
    "QQQx",
    "GLDx",
    "BRK.Bx",
    "LLYx",
    "UNHx",
    "WMTx",
    "ORCLx",
    "MSFTx",
)


class ConfigError(RuntimeError):
    pass


def _dec(name: str, default: str) -> Decimal:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return Decimal(default)
    try:
        return Decimal(raw.strip())
    except InvalidOperation as exc:
        raise ConfigError(f"{name} is not a number") from exc


@dataclass(frozen=True)
class Settings:
    rpc_url: str
    private_key: str
    arm: str
    jupiter_api_key: str
    min_trade_sol: Decimal
    min_account_usd: Decimal
    max_trade_sol: Decimal
    fee_reserve_sol: Decimal
    max_positions: int
    loop_seconds: int
    priority_fee_lamports: int
    data_dir: Path
    confidence_floor: Decimal = CONFIDENCE_FLOOR
    confidence_ceiling: Decimal = CONFIDENCE_CEILING

    @property
    def armed(self) -> bool:
        return self.arm == ARM_PHRASE


def load_settings(require_arm: bool, require_key: bool) -> Settings:
    rpc = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com").strip()
    key = os.environ.get("SOLANA_PRIVATE_KEY", "").strip()
    arm = os.environ.get("WELP_ARM", "").strip()
    if require_key and not key:
        raise ConfigError("SOLANA_PRIVATE_KEY is empty")
    if require_arm and arm != ARM_PHRASE:
        raise ConfigError(
            "WELP_ARM must be TRADE-LIVE. WELP UP! has no simulation mode."
        )
    if os.environ.get("WELP_SIMULATE") or os.environ.get("WELP_PAPER"):
        raise ConfigError("Simulation flags are refused. There is no paper broker.")

    min_trade = _dec("WELP_MIN_TRADE_SOL", "0.001")
    min_account = _dec("WELP_MIN_ACCOUNT_USD", "0.50")
    max_trade = _dec("WELP_MAX_TRADE_SOL", "0.02")
    reserve = _dec("WELP_FEE_RESERVE_SOL", "0.003")
    if min_trade < MIN_TRADE_SOL:
        raise ConfigError("WELP_MIN_TRADE_SOL cannot be below 0.001")
    if min_account < MIN_ACCOUNT_USD:
        raise ConfigError("WELP_MIN_ACCOUNT_USD cannot be below 0.50")
    if max_trade < min_trade:
        raise ConfigError("WELP_MAX_TRADE_SOL is below the minimum trade")
    if reserve < Decimal("0.003"):
        raise ConfigError("WELP_FEE_RESERVE_SOL cannot be below 0.003")

    try:
        max_positions = int(os.environ.get("WELP_MAX_POSITIONS", "2"))
        loop_seconds = int(os.environ.get("WELP_LOOP_SECONDS", "45"))
        priority = int(os.environ.get("WELP_PRIORITY_FEE_LAMPORTS", "1000"))  # Default to 1000 lamports (0.000001 SOL)
    except ValueError as exc:
        raise ConfigError("numeric WELP setting is invalid") from exc
    if max_positions < 1 or max_positions > 5:
        raise ConfigError("WELP_MAX_POSITIONS must be 1 to 5")
    if loop_seconds < 20:
        raise ConfigError("WELP_LOOP_SECONDS cannot be below 20")
    if priority < 0:
        raise ConfigError("priority fee cannot be negative")

    data_dir = Path(os.environ.get("WELP_DATA_DIR", "data")).expanduser()
    return Settings(
        rpc_url=rpc,
        private_key=key,
        arm=arm,
        jupiter_api_key=os.environ.get("JUPITER_API_KEY", "").strip(),
        min_trade_sol=min_trade,
        min_account_usd=min_account,
        max_trade_sol=max_trade,
        fee_reserve_sol=reserve,
        max_positions=max_positions,
        loop_seconds=loop_seconds,
        priority_fee_lamports=priority,
        data_dir=data_dir,
    )
