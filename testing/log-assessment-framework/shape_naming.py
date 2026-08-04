"""
Shared "Naming the derived shape" primitives (Log Assessment Framework,
Structural Fingerprinting section). This is deliberately the ONE module
both v1 and v2 import identically -- the word lists and hashing scheme are
supporting configuration, not the procedure under test, so sharing them is
what makes a codename comparable across the two independent
implementations. What v1 and v2 decide independently is WHEN to invoke
shape derivation at all (named vs. unnamed format) and WHICH derivation
method applies (delimiter+arity vs. masked token skeleton) -- that logic
lives in each script separately.
"""
import hashlib
import re

# Two curated word lists, per the framework's "Docker/Heroku container-name
# pattern" reference. Any reasonably-sized curated list is spec-compliant;
# what matters is that indexing into them is a pure function of the hash.
FMT_ADJECTIVES = [
    "amber", "bold", "calm", "dusty", "ember", "faded", "gentle", "hazy",
    "icy", "jagged", "keen", "lively", "misty", "noble", "opal", "pale",
    "quiet", "rustic", "silver", "tidal", "umber", "vivid", "warm", "young",
]
FMT_NOUNS = [
    "adder", "badger", "condor", "drake", "egret", "falcon", "grouse",
    "heron", "ibis", "jackal", "kite", "lynx", "marten", "newt", "osprey",
    "puffin", "quail", "raven", "shrike", "tern", "urchin", "viper",
    "wren", "yak",
]


def shape_hash_of(shape_token: str) -> str:
    """8-hex-char digest of a shape token string. Deterministic, no
    randomness -- the same token always hashes to the same digest, on any
    run, any file, any machine."""
    return hashlib.md5(shape_token.encode("utf-8")).hexdigest()[:8]


def codename_of(shape_hash: str) -> str:
    """codename = 'FMT-' + adjective[hash_byte0] + '-' + noun[hash_byte1] + '-' + hash[:4]"""
    hash_byte0 = int(shape_hash[0:2], 16)
    hash_byte1 = int(shape_hash[2:4], 16)
    adjective = FMT_ADJECTIVES[hash_byte0 % len(FMT_ADJECTIVES)]
    noun = FMT_NOUNS[hash_byte1 % len(FMT_NOUNS)]
    return f"FMT-{adjective}-{noun}-{shape_hash[:4]}"


def codename_for_token(shape_token: str) -> tuple:
    """Convenience: token -> (shape_hash, codename)."""
    h = shape_hash_of(shape_token)
    return h, codename_of(h)


_DIGIT_RUN = re.compile(r"\d+")
_ALPHA_RUN = re.compile(r"[A-Za-z]+")


def masked_skeleton(text: str) -> str:
    """Digit runs -> 9, letter runs -> A, punctuation/whitespace preserved.
    E.g. '2026-07-31T04:03Z' -> '9999-99-99T99:99A'. For genuinely
    unstructured-but-fixed-shape lines with no clear delimiter to count
    arity on."""
    out = _DIGIT_RUN.sub(lambda m: "9" * len(m.group(0)), text)
    out = _ALPHA_RUN.sub(lambda m: "A" * len(m.group(0)), out)
    return out


CODENAME_PATTERN = re.compile(r"^FMT-[a-z]+-[a-z]+-[0-9a-f]{4}$")
