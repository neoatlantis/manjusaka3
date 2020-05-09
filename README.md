

### Payload Packet

Each payload packet is a JSON object. This object must carries one `type` key
which value MUST be either "plain" or "encrypted".

#### Payload packet with `type == "plain"`

```json
{
    "type": "plain",
    "plaintext": "...", // optional, but must be string if present
    "clues": [ // optional, but must be a list of CLUES if present
        CLUE1, CLUE2, ...
    ]
}
```

#### Payload packet with `type == "encrypted"`

```json
{
    "type": "encrypted",
    "ciphertext": "...", // mandatory, must be an armored ciphertext by OpenPGP
                         // ciphertext is encrypted with multiple passwords,
                         // and public key encryption is ignored.
    "clues": [ // mandatory, must be a list of at least one entry below
        [ CLUE1, CLUE2, CLUE3 ],
        [ CLUE4, CLUE5, CLUE6 ],
    ]
}
```

An encrypted payload packet as above contains a ciphertext which can be
decrypted when conditions match. Condition to get that password is, when
at least one set of clues within the list given by `clues` key is solved.

#### Clue sub-packet

A `clue` type is an object having following format:

```json
{
    "id": "...",    // mandatory unique id

    // "hint" and "value" are mutually-exclusive

    "hint": "...",  // optional, must be string if present
    "value": "...", // optional, must be string if present
}
```

This type is a value-provider. It provides a secret used for finding out a
decryption key. The secret is either predefined by `value` key, or is asked
from the user if `hint` is present.

`hint` and `value` are mutually exclusive, only one of them can be present
in one clue subpacket. It is allowed when neither is given. In that case,
the clue is a reference: It takes the value when another clue packet with
the same `id` is answered.

It is noted that `clue` may represent multiple values when used as user input.
This is useful, for example, when multiple pathes are to be determined by this
input: a "clue1" may be used to decrypt encrypted packet 1 and 2, where both
packets require only "clue1" but are encrypted with different values.



### Decryption algorithm

A MANJUSAKA self-decrypting message contains a list of multiple packets. As
stated above, packets are either encrypted or plain. Whenever a plain packet
is seen (either exists at beginning, or being yield by decryption of another
encrypted packet), the plaintext(if any) is presented to the user.

Independent from the packet types, each packet may carry a set of clues. All
these clues are collected and evaluated. When hint in clues are seen, user
is questioned. 

After each question is answered, the clues are re-evaluated. Any remaining
encrypted packet is tried with clues for decryption. An encrypted packet
MUST contain another packet, either plain or encrypted. The whole process
ends when either no more undecrypted packets exist, or at least all clues are
set.
