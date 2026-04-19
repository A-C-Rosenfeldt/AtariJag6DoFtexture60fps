So, I have seen code from that era / for that hardware. It is quite distinct from id tech or NDC in OpenGL. Especially, they use one large playfield of 65536x65536 to project to.

This fits the 16bit of the Jaguar MUL instruction. So I can still calculate x\_steps while going down edges. Also clipping on the view (320x240) works.



The DIV instruction is unsigned. Feels a bit weird to have (0,0) at top left. Anyways, overflow is to be avoided. There still is a viewing pyramid. Just with a very large field of view.

With such a large FoV it does not make sense to truncate it into a frustum, other than that it is fast and we need to avoid divide by 0 anyways.

The JRISC DIV instruction can be set to 16.16 fixed point. So we divide 16.16 bit by 16.16 and get .16 . Our view! Projection directly accepts the result of the Matrix transformation.

This is correct also for OpenGL, or my float (even fixed) point approach. And indeed I will always spend 2--4 bits on sub-pixel correction just to not look like the PS1.

The playfields extends are still 4 to 16 times larger.



Like in my pixel based projection ( fits a portal renderer ) and unlike OpenGL, there is no rounding error after this. We just SHR.



So obviously this encompasses a guard band. So for small triangles it may makes sense to clip them pixel by pixel, line by line. Though I doubt it. Imagine a top vertex left outside of the view.

Then we would loop down, until the edges enter the view. JRISC is slow doing this. JRISC is good at Maths, but bad at jumps.



3d Clipping leads to rounding errors. Edges could cross. With vertices in the playfield, no rounding occurs at clipping. For the rest of the vertices the chance of crossing are far lower. So it is not perfect, but okay. Especially, it does not happen obviously when a polygon hits the view borders.



Projection works well with floating vertices. In 2d we don't care for the different exponents. Of course we still need to keep the code around for vertices behind us. So it is more like a speed up.



Texture mapping is a bit detached in my renderer (inspired by Doom). I don't see how this changes anything. The other engines which extend affine texture mapping beyond the view look ugly to me.

Yeah, well, for small triangles we could use affine texture mapping (GuardBand). I define those triangles this way: delta (including fraction bits ) <= 8 bit.

Affine texture mapping inverts a matrix. So the determinant as products: 16 bit. The nominator is multiplied with the UV map (also 8 bit?). Then we multiply pixels with it => 24 bit.

24/16 bit in the normal DIV gives us 8 bit texture coordinates. If we had bi-linear interpolation, we could (24<<8)/16 = 16.16 / .16 = 16.16  ( 24 bit fractions, uh! ).

So: not critical, no rounding. Texture stays withing the triangle (higher polygons don't work). Well and it feels like 16bit delta is possible. So nothing limits us.

The address generator sadly cannot do Bresenham. We still have to round the endpoints. So on Jaguar we don't win no no-glitch points.

That would be a hardware idea. User vectors to get Bresenham to speed. Looks like 16bit adders are enough. DIV limits the clock on the Jaguar so much. We could do Bresenham in a single cycle.

But Bresenham would also work for vectors. Or for leaping with filling in a second stage of the pipeline.



Any edge with vertex outside of this large viewing frustum will fall back to my narrow pyramid code. 3d vectors. Cross product, inner product. Some sign math. Checks at corners. Clipping.

This code still needs to be tested. This would be difficult if the wide FoV code is in place (activated).











