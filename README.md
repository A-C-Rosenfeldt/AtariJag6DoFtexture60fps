# Roadmap
	rotating cube
		portal davor


# Motivation
One motivation is to check if a beam tree rans smoothly. It is actually not that interesting to build a hybrid which switches to traditional ways for speed.
Also I could not find clear documentation about the z-buffer and saturation and phrase alignment. And I have no GPU ticks to spare for the Atari two pass texture mapping.
So in the end the code will not be very specific to the Jaguar. I only use the stupid blitter. Maybe add render-parts to linebuffer like in AtariKart later.

The other motivation was to check if rounding crashes the renderer. I guess that a few glitches here and there are hardly and argument, so uh infinite precsion hmm .. for 8 bits?
My head tells me that the renderer will not crash and that glitches are random and low in number even if I went with 16x16=32 MUL.
Visible glitches in Jaguar games (and even vanilla PC Doom) seem to stem from arbitrary rounding to integer, while the registers still had free bits.
Even for textures and PVS it seems like an epsilon avoids all glitches. For a texture this means that we add a little safety space in an atlas at incompatible seams. Ah, I want bilinear!!
Small jaggies on edges in a beam tree will probably also be hard to notice.
With fixed point I feel the need to run a static manitissa calculation through the code.
With floats the GPU has higher precision than the blitter. And that is my aim. Shared exponent in Vec3, though the more complex calculations in a beam tree seem to like real floats and really hate fixed point.
This will be more important when I clip to portals instead of the frustum because then I will really use Vec3 instead of Vec2. Uh, I need a portal heavy level and maybe even vehicles with doors.
I am very interested in the speed difference, but I don't like the doubled memory requirements. Why can't the Jaguar not just have 32x32 MUL also?
Okay, don't dwell on it. I start with fixed point in a KISS way: MUL;SHR 8  and DIV with the fixed point flag.

# Memory limit
So it seems like I stress myself out about caching and parallel excution. At first I need code going. So sequentiel operation. Lots of 32bit data access to DRAM from the GPU. Just get some performance numbers.
BeamTree equations in normalised device coordinates look as complicated as in real 3d and need almost as much bits. But in 3d ( thats why it is called Beam ) the expression make sense as Vec3 expressions with cross and inner product. My main motivation is to avoid the slow down when we face an enemy in "sky hammer". The enemy occludes a lot of area of the level.
So I have the level -- maybe even a hybrid tree made of BSP and convex shapes for the portals -- and then use the enemy ship to occlude a lot of this.
In thise scene the frustum plays a minor role. Of course I still clip against the frustum prior to this to easy debugging, but I have nice equations and code.
Texture mapping matches this approach by using the looking glass thief way ( and basically the Doom way ): map textures in 3d with an explicit normal and use Matrix inversion (in 3d).
Jaguar has a problem to combine shading and mapping. Like Skyhammer maybe I start with constant shade per polygon.

# Single Responsibility 
It seems like I need a special routine to merge a (convex) polygon into a tree. So with two polygons stuff gets a little arbitrary. Maybe I need to allow polygons in leaf nodes, like when there are only two
convext polygons and they don't collide. Just finde a "separating axis" on one of them and be done. I thinkt that this fits with the float-epsilon direction I want to change to.
Single responsibility lets me write the BSP code ( with this polygons) independent from the implementation which could either use already clipped normalized coordinates (this clipping works well on Jaguar),
or really 3d beams (when we assume that we have high detail and mosty polygons are clipped by other polygons and if it only is the cockpit).

# Math
JRISC instruction really seem to like floats. I tried to come up with signed fixed point as needed for vectors and it is not really faster, but 32 bit give higher quality.
Still there are so many places where I want a compiler or self-modifying code to float stuff. But then the MUL instruction is fixated on the lower 16 bit and so I guess that I can help it.
Ah no, just check the rotation matrix. Sine / cosine ideally use 8 integer bits. I don't want to hard code this. I want a compiler, maybe even running at boot time.

# Interleaving transformation and blitter
I want to resovle visibility before rotation to have it done as fast as possible. Then transformaton and shading (and walking the edge) can happen in parallel to blitting.
I still feel like this resolution will take a lot of time, but ranges also cost a lot of compute.

# Scrap this Racing the beam does not work on this system
The fastest methods on the Jag (64bit fast-page) are clearing the buffers ( frame and z)
and reading the buffer to display it on screen.
Memory is not an issue. Google found me on Atriage.com the Doom code
 the GPU write the $6C1 value in the vmode register wich is : $0006C1=VIDEN | MODE_16CRY | CSYNC | BGEN | PWIDTH_332
 and
 and $00EC1 is : VIDEN | MODE_16CRY | CSYNC | BGEN | PWIDTH_166

Bits 9-11 PWIDTH This field determines the width of pixels in video clock cycles. The 
width is one more than the value in this field.

(6 >>1 =3  )+1=4
(4*2=8 ) -1 = 7 )*2 =14
ABCDEF
01234

So we reduce the number of pixels to keep our high frame rate and to use less memory.
We have memory where the OP can load a texture to.  -- Benchmark: Different texture positions: linebuffer, GPU, CLUT, 16x16px

The fastest way to react on the blitter end is to prepare everything on the CPU and 
0 GPUGO  GO=false and wait for the blitter.
For longer lines, a different interupt may be needed.
I guess the GPU will be busy also, so I could just use normal interrupts.
There is no tight loop and the algorithm ( beam tree) is going to be complicated.
Maybe the stopping technique can be used at the end to flush the buffer.
GPU DMA priority and Blitter busHog to not lose any cycles. .. DMA priority is not well tested and we don't even want to access external RAM. We could request a vertex while the blitter runs.

Triangel rasterizer code is indeed a loop. Since I don't care for coherence
and in pixelMode the blitter forgets to switch to the next line anyway,
I could draw triangle ( halves ) from top an bottom ( switch register set). This also means that we should probably be able to draw quads .. when we need to split a large texture
Every line the code modifes itself to move the wait for the blitter up.
One half starts at the upper vertex. The other half starts at the center vertex.
Though instead of self modify, a simple interrupt is probably best.
Interrupts force a call to an address in local RAM, given by 
sixteen times the interrupt number (in bytes), from the base of RAM.
Interrupts are always in register bank0... so still feels like either needs to load data from RAM or branch or be modified ( one less SRAM access ).

Code path:
CMP xWidth, 1
JR N, skip line  -- we fell into the cracks between the px 
JR Z, StoreB     -- but z compare and write? (optionally) , 
Blitter loop

The linebuffer is a bit unconvinient because we need to switch between two textures .. Async bugs.
The GPU needs to start its loop while Horizontal count indicates that the texture is loaded by OP.
Vertical count needs to be checked if anything went wrong. We need to update the object for the next texture and use the old texture then.
Before the screen ends and buffers will be swapped, we have to draw a different texture.
So we always need two code paths. We can check timing and if both create the same image. Maybe compare with no caching.
Caching texture in GPU RAM is faster than in CLUT because GPU got a 32bit write gateway to the bus load code and data fast.

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

# Possible games, where the Jaguar could blit directly into the line-buffer
(I gave up on texture loading using the ObjectProcessor).
A space shooter should be possible. I want a story like in an Adventure Game. A puzzle game. Not so much based on skills. All ships with texture and shading (directional light source).
Change of resolution depending on coverage. Like Doom did it for the stats bar.

3d cars on a pseudo3d track. I don't know if there is enough fill rate left to paint the street like in Atari Karts or Super Burnout (still dunno if it uses the OP).
Actually, with pseudo3d I mean that I don't draw to many road polygons per scanline. No tunnel. Though, even with a wipe-out tunnel, fill rate is the ultimate limit.
I guess like a frame buffer for the far away part of the road is actually the way to go for the Jaguar, but don't use a slower frame rate there. That would be ugly.
Rather letter-box , cockpit-view, low-res . Vertex count is a problem. Jaguar can only do the corners of the road, but no full tunnel. Indeed use OP for scenery ??

Fight4Live should be possible at 60fps. Make the fighters small. I don't know about OP. Maybe there is some speed-up possible to have second playfield only where there are polygons.
Less memory to clear. Blitting bitmaps is so inefficent on Jaguar that I rather not draw a background.

Scanline-rendering likes to draw while doing a lot of maths. This is great for the blitter and for even polygon density with the line-buffer.
A beam tree is better at identifying high polygon density. Then nodes could be pre-rendererd.
# Todo
https://github.com/toarnold/jag2048.git
https://hub.docker.com/r/toarnold/jaguarvbcc/
# compiler needed ?
Vector code naturally fits the pipeline. Though we want to use 256 register names to use the nibbles to denote vector and component.
The pipeline in conjunction with the two way register file want two threads. With Vec3 we get ugly code which is better left to the compiler.
The programm needs more registers and more memory then present in the hardware.
Even withouth functions, and blocks only, I want to denote a *Register as new if I don't expect it to have a value.
Likewise I denote the last use of a register as ~Register.
Block borders pass all registers in and those also out again, but none if they are followed by a , . Passing registers have to be named explicitely .. maybe with renaming. 
break;continue; can be placed in any combination on a line. I hope to avoid labels this way.

I already have an example for visitor pattern or so. I have 4 functions and when the cursor moves, we may jump from one function to another.
We have this for source ( texture or vertex buffer ) and for target ( frame buffer ). So kinda want all combinations of double inheritance. Generated at runtime (load code). Then it executes the textureMapper.
Alternatively we have ping / pong function pointers. Source or target side either jump conditionally to pong or the move their ping pointer and then unconditionally jump to pong. jump is as cheap as branch.

Von Neuman architecture means that we want a common memory manager for code an data.
Code is structured .. so we look for cuts at low indent.
functions and objects can be declared within the structure and the position of the first call. This call sets the return address behind the function. Other calling places just let it return... A function needs a name!!
But for list or array there is no such trick. They are allocated trailing to the code. Code does not wrap around at the end of the memory so we need to find loopes which exit in the middle and place those at the end.
Or data in front where it can live until code starts whith does not need the data anymore.

There are no Macros. Functions can have the "inline" qualifier. Since we don't self modify ( thanks to so many registers ), there is no need to keep a single instance.
The compiler can count the bytes and only keept the function is is saves a lot of money or is dynamically pointed at ( enum of functions ).

R12 and R15 are preassigned for addressing. R31 is for backup of PP on interrupt. Some addresses are reserved for the interrupt routine. And likewise maybe some addresses are the result of a hash code on data. 

Lots of registers while interrupt disabled.
Branch delay slot via hint.
Often the vectors are feed into MultiplyAndAccumulate sequences. These don't mix with other code ( why even? ), especially loops.
Thus most small loops are unrolled anyway. You can read the memory requirements (I avoid MOVEI mostly) and the speed from the line numbers.

We have to interleave two threads for the pipeline and to reuse the last output register as input ( we cannot interleave 3 threads).
This makes the code hard to read.
Now I did use all registers. Also I like to use 256 registers in hex notation to be systematic. So at least close the gaps.
I read that Java goes through the code and marks the range for registers. So I can reuse the register after that ( only for(;;) considered).
Preoccupied: 14,15  or what the name was. Just boring.
Manage constants (transform between them with one instruction? A chain) .. Offset for address has range limit, center.. bases!
I guess that the np-hard part is to decide when to swap out registers into SRAM ( 64 registers vs 1k SRAM words .. alread full with code and vertex and pixel cache. uh). So we swap out only minimal amount of registers. So after our first assignment will may have too many regs. We can try to combine any two of them
and swap them out outside of loops ( ask assembler for free slot). Memory slots again only live for the range of the original registers and are reused,
unfortunately we cannot swap directly in a load store architecture. Anyway the SRAM may be congested. So we spread store and load.

So Doom does not seem to have functions. Only if else and for . So they split the code outside of the loops.

With functions ( methods ), we have a range where the function is used first to last.
We don't want to check in inner loop for function. So the loader loads the function at the block start.
All following blocks which need the function don't overwrite it.
The np-hard problem is to keep multiple functions. So I don't have so many functions and this problem is only interesting if functions are not moved.
So I can only change the order of the function and let them fall down all blocks until they land on anything. We can brute force it , faculty:
1,2,3,4,5
1,2,6,24,120

Optimization (the np-hard part) is incremental and stored in a database and visualizer.

I feel like I need small helper functions => inline   can be optimized to squeeze out some space.
Likewise maybe there is some loop-unrolling ( optional ).
The loader can do these two ( debug on emulator! ).

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

# BeamTree with span buffer and bit masks
I cannot read back the z-buffer and not even gather statistics to switch over. There is no elegance, but it may be put back in later.
On the other hand the GPU can work fast on bit patterns to calculate coverage.
So I want to utilize 8 directions const-z rendering, so the horizontal resolution is not the only important one, like with 32bit  in the GPU we only need 10 values to cover a scanline in CGA resolution.
If I go the tile path ( only for coverage, const-z, Bresenham, and forward rendering of texture patches don't like tiles ), and use Doom resolution ( 160x200 ), I could cover "squares" of 4x8px .
Or I say I want a recipe for the pipelining in JRSIC and always .. ah who cares. I need to ROR and check with overlapping tiles anyway.
Unfortunately JRISC has not ANDN nor ORN ( test in other languages ). Only CMP. At least we could use OR to fill coverage, and we use AND to  ..
Ah, I see, the z-buffer may be important for const-z or generally long blitter runs behind a high detail coverage. We simulate the fineal coverage on GPU, but have less coupling.
This needs tuning: When to switch over? With the texture in GPU RAM ( renderer is fully flexible using self modified code) and known coverage, StoreW is quite fast.

So JRISC loves CMP? That is scanline and span buffer territory. How expensive is it to insert a span?
{
	CMP
}while( x ) 
Maybe if I do switch to bit patterns ( not tiles ), I can avoid links and just have an array with two sides for capacity.
Then when a span is removed (gap filled), I pull in the shorter side. When a span drops in a gap, I push the shorter side.
This would be most important when the span buffer is in RAM and I use LoadP to get it.
So I really would love to store all run lengths in a single phrase. It may help if the tree structure above cuts down, until I reach this limit.
I don't know how to switch back from span to tree though .. only next frame :-(

For our Beam tree comparison we need to multiply a lot. And we may need to check with floating.
The MAC may be close to zero. So we cannot decide where to edges cross. Now assume that these edges belong to large areas; then we don't want to switch to lines.
Variable precision on demand for very large area? We only feed through the deviation: The final MAC has 40 bits .. so no problem here.
But we had to round the factors to 16 bit. Now we need to MAC  ( AL * BH ) + ( AH * BL ) for the next 16 bit.
Alternatively we could calculate the scanline where all three edges cross and look if the scanline is far away from the crossing.
Then we could check if the pixels are far away. Thus we still get results about (complete) coverage.

I don't know if a BSP tree merger can sustain some more re-rounding. We already used the values for other checks.
What happens with the merger if we don't fully resolve the edge. It means that any edge crossing that pixel can also not be sorted into the tree.
We have a main assumption, but also mark the alternative. We only look at the alternative if we compare edges near that pixel.

For const-z I really want convex polygons from the BSP. I cannot use spans.
We choose the direction which gives the lowest z difference across the longest cut.
Ah scrap that. We like long runs. We use delta z after one step.
Diagonal z is longer thus only applies for a smaller angle.

We want to double buffer blitter register values in the GPU. So I draw long and short.
It seems like we calculat two spans. Then we check for idle. Then we allow the interrupt.
We prepare the interrupt for the second span and write the first span into the blitter.
The interrupt disables the blitter interrupt.
On a polygon we split at the other vertex most close to the middle of the extremes.


# Demo SceneGraph

Showcase figure with independent arms and hands. Vehicle with figure in it. Level with all angles and overhangs.
LoD. Abstract polyhedrons. Computer Solid Geometry : Unions

# Memory bus

## 64 bit

So I want to copy rectangles using phrase mode. I want to copy object/structs using phrase mode.
I hope to load balance both CPUs. So I start with freeing DRAM as much as possible and later may outsource some code or data.

If I could turn back time, the Jaguar should have been able to only activate some bytes of the 64 bits.
The memory controller would keep the pages for all 8 bytes.
Then memory could be configured to only place texture information into 8 or 16 bits of each phrase.
Place z-buffer and frame buffer in the other bytes.
This would probaby look a bit akwarked to the CPU while it loads the texture, but maybe the blitter can to the expansion.
Textures are great to reduce the need for popping geometry LOD. Mippmapping feel too complicated and popping for Jaguar.
So it would have needed cheap random access to single texels. Maybe neighboring texels at least reside in the same page, but even one fetch every 4 cycles would be okay if there was an internal queue
to bridge the line breaks. Framebuffer needs 16 bit and zbuffer needs it and video read out access them and hence they get more bytes.
SNES mode-7 would need 3 independent buffers, but timing on Jaguar only allows to interleave 2 banks before wait cycles kick in.
A GPU access could trash both pages, but luckily everyone else works on 16 bit and would only trash the page of one of the bank.
Yeah, one could dream.

These weird banks feel like a drakonian measure. Probably, mipmaps and a cache of the last 16 phrases would be better. And an output cache of the same size.
Developers could tune the switch points for speed. Switching would be along phrase boundaries ( for speed ).
This also works for the popular 16 color textures (4x4 texels in a phrase).
To speed up sky boxes made of bulky polygons, we need and infill of 4x4 boxes which utilize bilinear interpolation.

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
