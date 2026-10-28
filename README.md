# P+ Rollback-Safe Custom Cosmetic Tool

Rename custom Project+ skins to the filenames Dolphin's **Load Custom Textures** expects. Only you see them, so netplay stays in sync.

**Use it here:** https://aiko1r.github.io/P-Rollback-Safe-Cosmetic-Namer-for-BrawlOnline/

*(Beta. Built for Project+ 3.2.1.)*

## How to use

1. Open the site. On the **Upload & name** tab, drop in your modded textures as PNGs, or drop a `.pac` / `.pcs` skin file and the textures inside are pulled out for you.
2. Pick the character and the costume spot on the character select screen, then click **set names**. The spots follow Project+'s own order for each character, which is not always the same as the file numbers.
3. Download the zip and unzip it into Dolphin's `User\Load\Textures\RSBE01\` folder. On BrawlOnline that's `Brawl Online\netplay\User\Load\Textures\RSBE01\`.
4. In Dolphin, go to Graphics > Advanced, turn on **Load Custom Textures**, and restart the game.

Portraits and stock icons are not stored in a `.pac`, so upload those as separate PNGs. The tool recognizes them and names them for the spot you picked.

The **Database** tab lists every costume texture and the filename Dolphin expects for it, if you'd rather look one up and rename it yourself.

## Why it's rollback-safe

Adding files to the SD card changes the game and desyncs netplay. Dolphin's custom textures only change what your own screen draws, so nothing about the game itself changes. Other players see the normal costumes.

## Known limits (beta)

- Built for Project+ 3.2.1. If a costume's textures change in an update, its filenames change too.
- Tested end to end in game on Captain Falcon. Other characters use the same method but are not tested, so please report anything that looks wrong.
- Some textures (about 1,300 of 5,466) do not have verified names, marked in the Status column. These include textures for characters like Mario, Link, Donkey Kong and Sonic, so if any textures fail to load, report it.
- Texture swaps only. Mods that change the model (new props, accessories, extra geometry, or reshaped parts) can't be made rollback-safe, because Dolphin's Load Custom Textures only replaces images on textures that already exist. Only the recolored textures from such a mod will show up, and any textures that belong to added parts have no original to replace and can't be named. Using the real model means editing the SD card, which desyncs netplay.
- Some costumes have an language variants? (for example Falcon's 3rd spot). If a body texture doesn't show in game, try the alternate name the tool lists.

## Report a wrong name

Open an Issue with the character, the spot, the part (body, helmet, portrait...), the name the tool gave, and what you saw in game.

## Credits and license

Unofficial fan tool. It is not affiliated with Nintendo, Project+, or Brawl Online. Brawl and Project+ textures and artwork belong to their owners. The data files hold small fingerprints and thumbnails made from game files, used only to match your textures.

The code is released under the MIT license (see `LICENSE`).
