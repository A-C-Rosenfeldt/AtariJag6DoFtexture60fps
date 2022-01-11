# Synergy between bilinear interpolation and the cache
The texture is stored as 2x2 px in external RAM. MIP mapping is used to use the carry flag to see if we go into another row or column.
CRY is unpacked into 4*3 = 12 registers. When we move in texel space, 6 move instruction shift this "window" around.
The two new texels are unpacked. Ah, looks like two calls into the cache. I see no synergy.
# AtariJag6DoFtexture60fps
Atari Jaguar  6 DoF ( polygon beat-em-up or dog fight ) game with texture mapping running at 60 fps by also using the line buffer.
Right now I am coding to write back into framebuffer. Software renderer using the GPU and only phrase-mode blitter.
This way I can controll all caching (There is no trap mechanism in the blitter).
Currently it looks like a will draw a lot of small triangles simply scanline by scanline.
If I use a 4 associative texture cache, I can read 4 values for bilinear interpolation without trashing myself even if zoomed out ( no Mipmaps ).
The same cache also allow to store 8 block long cached lines in texture ram ( 2x2 cache lines ).. good enough for scanline rendering.
# Todo
https://github.com/toarnold/jag2048.git
https://hub.docker.com/r/toarnold/jaguarvbcc/
# no compiler needed
Vector code naturally fits the pipeline. Lots of registers while interrupt disabled.
Branch delay slot via hint.
Often the vectors are feed into MultiplyAndAccumulate sequences. These don't mix with other code ( why even? ), especially loops.
Thus most small loops are unrolled anyway. You can read the memory requirements (I avoid MOVEI mostly) and the speed from the line numbers.
# documentation
Website with a code editor. Left sane assembler -- right reordered, renamed for JagRISC.
Canvas examples to show BeamTree.
# scene-tree based

- start with scene graph
- BSP on top to do the hard decisions

## walk the tree
Multiple cursors to monitor all overlapping branches ( the others ). Use BSP to do loose front to back. How to check for overlap using BSP? You cannot project them, only merge in 3d. We would have done that before. Projection needs to have an effect. What if we have a project vector? We can use before we define "full" and empty values, which would need multiple faces to have "in" and "out".
Cuts between planes => lines. Line + projection vector => new plane .. we can work with this.
When we walk down the tree, the lines get shorter and shorter. Uh, what does this mean for our beam tree? Tree construction typically elongates the lines. But not too much please! So as usual, use large lines / planes as splitting candidates. Do 

Overlapping branches merge their beamtrees. Take our vs take theirs: which has better balance and does less splits.

Are there occluders formed? I don't believe so. Still front to back! Proven visible lines get higher priority. But only some tree levels. Here switch to back to front when we are only looking at minimal overdraw. Switch to z-buffer if we can sort because triangles end up in multiple branches and we are already at small detail. So this could be shown really well on screen.

On the one hand without BSP I loose all motivation. On the other hand BSP is only an acceleration structure for z-buffer.

## switch to back-to-front or even z-buffer
So on the target plat form the z-buffer is flat. It is thus efficient for stuff < 16 px.
I would love to explore synergy with far and near z-plane limited to the range is question.
Also clear and set buffer based on situation. For example a large triangle in the back should just set the buffer ( not read ). It is the Quake approach , but as OOP instead of architecture. Also I could allow penetration. Like detect it in 3d. Detect that the cut is visible. Detect that I need z-buffer anyway.

I feel that I don't have the memory to store multiple code paths. Still a z-buffer code path would deal with John Carmacks critic of beam trees: Don't work on high detail. Considerable JRISC work is needed for the beam tree. Caching z-buffer needs memory. If branch if z-buffer needs to be read or written. Other parameters to blitter ( self-modifying code? ). Then there is another code path: Using the line-buffer. The idea is to reduce texture copy bandwidth. I would not even want to phrase copy texture used into a blank space. I dont really want the object processor to load the blank space either. Anons, what do?
So I use the object processor. It breaks on 4px boundaries ( phrase ). I can only have vertical boundaries.
Uh this all doesnt sound too nice. Okay lets think if we can put texture updates in the gap.
I mean the object processor fetches them into line buffer. There is no memcpy beforehand and no load from mem via blitter into our Code RAM. When the lineBuffer is filled, we have some time to rearrange stuff. Then buffers switch. I will deactivate clear. Or, will I need it for the black sky?
Anyway, the texture in the gap still needs to be copied into GPU ram for rotation. Object cannot do any rotation. Why should I even deal with object processor instead of blitter? Does not seem to help.

So line buffer remains. no z-buffer there. so  like not set nor read. So all beam tree including the 4px jaggie edges. And we can have no back to front rendering because the object processor starts immediate after switching buffers. I feel like I am back at Doom coverage buffers.


# Memory bus

## 64 bit

So I want to copy rectangles using phrase mode. I want to copy object/structs using phrase mode.
I hope to load balance both CPUs. So I start with freeing DRAM as much as possible and later may outsource some code or data.

## Linebuffer -- 60 fps

So the Jag has this cool line buffer. I hope to make my scene graph code flexible enough,
to compile a display list for the line buffer. Fillrate limited stuff. Fixed amount per line. Large texels.
I don't plan to meander anyway. I need to draw spans because

- the blitter can only do spans and only has enough registers for this
- we use 8x8 tiles for perspective correction
- we want to draw small triangles ( players, spaceships ) efficiently
- the GPU does not look like it can support meander with edges. We need to do upper and lower half separately
- the line buffer accepts spans. We want to draw over the phrase aligned data read from ram.


We cache the texture. Wraparound is not possible ( why the blitter is like this??? ).
I can only scroll a window which encompasses the line. I can update 4x4 px due to the phrase nature and no sane addressing modes on the blitter. Or update via CPU with high register?
Anything to store in the corners? Per triangle?? Shear? Split triangles ( one of many reasons ).

## dirty rectangles
Because fill rate will not be enough, I  yeah .. only in space I have flat shaded background. On earth I need gourad. Object processor can only be used for oldscool race with low detail road. Or for side scrolling beat-em up.
 
# GPU compiler

16 MIPS. So we have two instructions per px. Blitter does 8px for us. Max 16 px.
Transformation and set-up is somewhat more expensive. I have seen so many systems slower than psx :  Eearly PC accelerators. Still 486 is not thaat slow is it? Sure bad drivers!

## source file
Source is stored in a format similar to Jag. But 32 bit.
But more registers. No pipeline effects assumed in source.
Free opcodes are used for {} . Branch instructions just outside of these use these.
Branch Instructions use  Register.Flag notion . So the quick data is i
3 Register notation available.
Notion to mark register which pass { boundary ( parameters . Warning if these are ignored. Other registers are saved / renamed to keep them safe.

Comments inteleaved ( length bytes ).

Compiled version and link table  instruction positions and register names.
Recompiler tries not to be worse than old build

## interleaving

The GPU needs two cylces for every command ( div needs 16 and wait state does not work ).
The Register File has two ports. So the in the end we need to interleave two programms. Don't know why they did not go with hyperthreading? Sync is not easy.

this things help with interleaving:

- expressions
- pure functions
- inline methods with side effects
- forEach Vector
- new and delete for variables to limit bruce force reordering of ops

## caching

- methods
- generics hint at important objects.method
- object/struct: Load all data using blitter

Currying is setting some parameters of a function and passing it.
Delegates accept a function. Why again is all this so complicated in C#?
Do I want functions? 

So MRE cache was succesful. Can I use a static cache? Doom was static, but they were not satisfied.
So MRE it is. But chunk size? I don't want unnecessary jumps!

## code in main

Long code blocks in mainMemory are nice because there seems to be some phrase -> long -> word breakdown for our instructions. We can jump, but we do not really like it. I think this better goes into a second versions. Alignment for branches seem to be a problem for me. Also I have loops everywhere.
Definition:

Page is one block of 256 bytes.

All JUMP Instructions must sit on an address ending in 0,4,8 or C hex

All JUMP Instructions must jump to an address to an external page on 0,4,8 or C Hex

All JUMP Instructions must jump to an address with in a page on 2,6,A or E Hex

The JR instruction can sit any where

The JR instruction follows the same destination rules as jump.

all JUMP or JR instructions must be followed by two NOP's but certain instructions can be used in place of the first NOP.

 main to local and local to main.

JUMP instructions only.....must sit on an address ending in 0 or 8 hex...to or from local to main and main to local.

## branches
trying to move around instructions to safe some relative jumps. Otherwise replace with absolute jump.
Try to align starts to words. Fill the delay slot.

## register renaming

- (inline) functions
- scope
- destructor

The second set of registers is used in outer loop while the other is used in inner loop. Though switching takes time! I can deal with pointers. I don't need array syntax [][] . Indexed addressing mode is broken on CPU. Slow and buggy. Only last resort.

## Tom & Jerry
So I would like Tom and Jerry to communicate using consumer producer queues. This still does not trash pages in the memory controller. We can have the external bus every other clock if we miss pages in memory don't we. It seems Jerry can only do word transfer and not long word.
What do they mean? Word on this system is not really defined. Probably int16. Use int16!
Would be cool if Jerry would take on the tree code.

## Blitter is needed for everything
The GPU memory controller determines whether a transfer is local or external, and generates the appropriate cycle. The only difference to the programmer is that only 32-bit transfers are possible within the GPU local address space, whereas 8, 16, 32 or 64-bit transfers are permitted externally

Also block transfer from main.
