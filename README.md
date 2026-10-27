# P+ Rollback-Safe Custom Cosmetic Tool

Rename custom Project+ skins to the filenames Dolphin's **Load Custom Textures** expects. Only you see them, so netplay stays in sync.

**Use it here:** https://aiko1r.github.io/P-Rollback-Safe-Cosmetic-Namer-for-BrawlOnline/

*(Beta. Built for Project+ 3.2.1.)*

## How to use

1. Open the site. On the **Upload & name** tab, drop in all of your modded files that will be used for one costume. They can be PNGs or a `.pac` / `.pcs` skin file, and the textures inside a skin file are pulled out for you.
2. Pick the character and the costume spot on the character select screen, then click **set names**. The spots follow Project+'s own order for each character, which is not always the same as the file numbers. The tool keeps Project+'s skin order as it is, which is what keeps it rollback safe, so be sure of the slot you want to replace: your skin takes the place of whichever costume is in that slot on your screen.
3. Download the zip and unzip it into BrawlOnline's Dolphin `User\Load\Textures\` folder, which is `%AppData%\Brawl Online\netplay\User\Load\Textures\`.
4. In Dolphin, go to Graphics > Advanced, turn on **Load Custom Textures**, and restart the game.

Portraits and stock icons are not stored in a `.pac`, so upload those as separate PNGs. The tool recognizes them and names them for the spot you picked.

The **Database** tab lists every costume texture and the filename Dolphin expects for it, if you'd rather look one up and rename it yourself.

## Why it's rollback-safe

Adding files to the SD card changes the game and desyncs netplay. Dolphin's custom textures only change what your own screen draws, so nothing about the game itself changes. Other players see the normal costumes.

## Known limits (beta)

- Built for Project+ 3.2.1. If a costume's textures change in an update, its filenames change too but this is unlikely.
- Tested end to end in game on Captain Falcon ONLY. Other characters use the same method, so please report anything that goes wrong.
- Mipmapped and paletted textures (about 1,300 of 5,466) are not tested and are marked as such in the status column 
- Some costumes have an variants in the files (for example Falcon's 3rd spot). If a body texture doesn't show in game, try the alternate name the tool lists.
- On the original Project+ Dolphin, the Load folder may already hold P+'s HD cosmetics (`.dds` files) that override yours. Move the ones with matching names out of the folder. BrawlOnline doesn't have this problem.

## Report a wrong name

Open an Issue with the character, the spot, the part (body, helmet, portrait...), the name the tool gave, and what you saw in game, and describe your issue to the best of your ability.

## Credits and license

Unofficial fan tool. It is not affiliated with Nintendo or the Project+ or Brawl Online team. Brawl and Project+ textures and artwork belong to their owners. The data files hold small fingerprints and thumbnails made from game files, used only to match your textures.
Entirely made by claude, simply to solve this niche issue use it or dont <3 

The code is released under the MIT license (see `LICENSE`).
