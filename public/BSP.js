/* So it occured to me that my hard limit is cache memory. I feel like a BSP is most efficient to keep temporary data for occlusion between solid polygons. Transparent textures ($0000$) may come later.
With forward or backwards ray tracing the math subroutines throw exceptions when they are unsure.
With backward tracing I set up a graph of dependencies ( and may keep it frame to frame ) and pull in more precision.
With forward tracing (now that I understood normalized device coordinates and really accepted MUL to be cheap), I set up 2x2 px boxes around critical cuts.
These boxes are represented by a special (for fast rasterization) BSP ( to allow merge ) top, bottom, left, right ( from root to leaf ). Yeah, a little degenrated, but that may change on merge with balance?

Inside these boxes and later perhaps also inside of small height nodes I use a traditional method to solve occlusion.
I also calculate z at every pixel and compare it. It does not really matter how I nest the loops. With a low number of pixels I can keep it all in SRAM?
At least I feel like I don't want to compare delta-z . This may lead to new questions about precision. So no scanline-algorithm in version 1.

For each leaf I keep a z range to use it as an occluder. Before all children are drawn, one border is the far plane.
It feels weird to compare aligned planes inside my BSP world. I had a good reason to do it on screen, but not in 3d? Hierachical Z seems more consistent.
Ah I remember, for z I use the parent node. The children are only needed for opacy.
Even the pixel based renderer must report back if all pixel have been filled. Collsion control on the backplane can be used, perhaps? Though we don't want to write anything !?
    F02278

This BSP code can be linked to either forward or backward maths ( JS sure can to this and on JRISC I want to employ some kind of JIT for DRAM -> SRAM anyway (even if memory constraints push this onto the 68k)).
The interface asks about the "spin" of an intersection of three edges and some more simple stuff.
The result is boolean for building a tree.
Then there is the interface to project stuff onto the NDC on screen. It involves division (overflow outside of [-1,+1] indicates that the BSP code has a bug) and gives us one of the ordinates (x,y,z).

In the backward case the math routines operate on Vec3. In the formward case they operate on Vec2.
The "not sure" result lets the BSP call back solutions .. Oh wait. With backward the math part solves this internally. For this I already need to have the dependency graph in memory. No BSP replay, I guess.
With forward the BSP gets projections anyway I think? With unsure set, it sets up a that 2x2 box ( hard coded routine ). This then goes to the default merge code ( recursion).
Do axis aligned lines overflow? NDC stresses that the frustum is not only aligned, but at a spedific position.
*/
/*
The thing is that I already specified that I will have 16 bits for each ordinate. So most of the screen is glitch free even with fixed point math.
I can just go ahead and code a simple forward rasterizer with upper, left pixel rule and so.
I don't even need an extra bit for uncertain results. I just check if ABS(fraction) after round to neareast is too small (or something like this).
So the code just goes ahead and divides for cuts and slopes, and throws in case. Slopes are not a problem right away, but we could need to have two checks.
Scrap that. Jaguar ( and 0x86 and SH2 ) have 32 input to div. So we know the slope in an integer precise way. Feels weird man.
*/
/**
 * I feared that I cannot write readable code if I am not allowed to use operators, but it looks like that I need vector operations anyway. These don't use operators in most programming languages.
 * So I can plug in math modules with (low precision) integers or infinite precision (and profiling on memory use and instruction count). Going from forward to backward.
 * To motivate the precision issue I would have to simulate different word sizes ( 8bit, 16 bit(Jaguar), and 32 bit (PC)).
 * It will be interesting to see some performance regarding the BSP splitting. With Heuristics I cannot come up with a clear winner, so maybe use none? Let's test. Then some length or area based version.
 * Then keep the BSP over frames and iterate? Fuse polygons before span rendering (like Doom floor)?
 * Then in a second step I may look for a heuristc when to switch to horizontal spans or even pixels. With pixels there is this problem that z-buffer either destroys shading or introduces an overflow problem (buggy).
 * There is no nice mathematical reason. I could just follow JC and accept that the z-buffer is broken.
 */ 
//# sourceMappingURL=BSP.js.map