import { Vec2, Vec3, Matrix2, Matrix } from "./clipping";
import { Edge_w_slope, Vertex_OnScreen, Corner } from './Item';
import { Polygon_in_cameraSpace } from "./rasterizer";
// Well it seems I failed the tolarance and even the DMZ. I am not quite sure if it is the maths, or JRISC, but glitch free is expensive with these
// The unreal ( because it does not exist in the real world ) inifite precision is mathematically more clean and lends itself to compact JRISC ( to fit into 4 kB )
// The bummer is though that even inside Bresenham a precision Exception can be thrown. But this is it:
// Ordering is done using cuts on screen. This allows for low precsion in easy ordering case. I catch intersections outside of the Bresenham innerloop.
// Texture gaps are different from polygon gaps. I don't have to please boths sides of an edge. Just clamp to the Atlas. Very sad that Jaguar GL_REPEAT is broken.
// I mean: The DDA happens inside the blitter anyway. Of course I could aim for a specific sub-pixel precision on the start and end texel of the span?
// The effect is that polygons will be drawn only partially. All the local variables need to be dumped for later because I cannot fit all code needed for the pipeline into the cache.
// This also means: Zero overdraw is mandatory. No transparent textures are allowed.
// How to proceed in the following scanlines? I think that I can estimate a precsion which will allow me to draw 99% of all spans. Then fill in the rest later.
// So I don't need to dump all variables, just polygonID and y and a bitfield: left? right? And if I want: texelLeft? TexelRight?
// In my current float.asm I feedthrough precision explicitely. Bresenham does not mutate it inside the loop, just read
// if akku>tolerance then goto less_probable_step
// if akku>-tolerance then throw
// // probable step
// using fractions is difficult ( there is something in this file ), but two edges forming a portal in 3d feels natural
// as we go through the portals, we collect the cuts. And we collect edges: Each edge = (vertex-camer) x slope . Cut = edge0 x edge1 ( of course real vertices stay as is ).
// inner product with edge2 tells us if edge2 is visible throught the portal. (again: beam normal is cached in graph)
// Now the reason: Cut in (x,y) on screen cannot be easily bound be geometric arguments using the DMZ, but it can using infinite precision and the naive 3d expression.
// In 3d the equation for this cut is simple and symmetric ( see above ). For projection we do 1/z ( float with tolerance ). Then multiply with x and y. (without infinite precision and thanks to the more powerful DIV, I would have used two DIVs)
// The projected cuts of the portal or even just the corners rounded to integer pixels ( rasterizer needs integer ). Ah with fraction 9.5 can be used to cull other vertices .. after they have been projected. This will not happen because I don't double check. Any double whatever happens in the graph upgrader. Perhaps later I build a hybrid . Obviously NDC is a bit more expensive with the graph. And portals don't care for NDC or guard band. BSP Beamtree is full of portals and full of edge cuts. For it I invented DMZ. But now it is dead. So no DMZ in 2d-BSP.
// It goes against my phiplosophy to DIV without bounds. But uh, what is philosphy ? Yeah, so it would be possible to get all the cuts in 2d. Check for zeros and check for overflow using bitscan (floats).
// I have the feeling, that portal corners may pull in more precsion one or two times, but then offer a fast test: inner product . Both factors floated . We do this for nxm . n-gon vs n-corner. And lots of polygons.
// We can then estimate the error of the result:  Lots of pulling in, so only the final rounding: 15 significant bits. This is a thin silver lining where the final innerproduct would have to be upgraded ( symmetrically to 30x30)
// Inner product can utilize MAC . 6 LoHi pairs look nice. So I need 3 bits for carry. If I don't want weird multi-register shifts, these carry take on the ripple from the 3 LoLo.
// Signed Lo Word better also is persisted
// Graph
// I keep the low precison nodes. The higher precision nodes may have other bits set in HI. So once a path pulled up precision, it only uses the upgraded node. But old pathes my still point to the old node
// operators are binary. So every node depends on two other nodes. As discussed above regarding the portals, many nodes can depend on a node. I don't want (growing) lists within my growing structure.
// So instead each node has one link to the higher precision
// The graph launches from the vertices in the scene. I am open scene graphs (Blender GeoNodes), but right now, these vertices are all materialized. Links can point to them
// Camera rotation is the first link, if I want flat n-gons (uh I want, like in Doom, am a fan. And actually, portals are n-gons and need to be flat). Otherwise I would hide this first step from the precision upgrader.
// ~ 2025-10-25 AR
// I want efficient 3d clipping. Instructions take time. I want to showcase portals. Not as band aids as in Tomb Raider, but as foam as in Duke3d.
// Already with NDC and even pixel clipping, the 3 cut order needs to be rechecked. So there is 2d checking. Just I don't want to apply it and then discard the vertex most of the time.
// This applies to both the walls in the room behind the portal and the ships.
/* I need to avoid overflow. All vertices need to be clearly inside .. yeah well if I use NDC, they have 1px guard band to not overflow
with portals we have to squeeze in two tolerance: NDC -> portal -> edge .
The 3d portal needs to be a little wider than the 2d portal. This feels expensive to be -- or at least disturbing to the concept.
Edge test also happens in 3d. Also needs wider portals. Okay, widening is rotation of the beam normals. Expensive: take xy, wedge, normalize. No:
r= sqrt(x^2+y^2)
z+= r
x += x/r * z
y += y/r * z

So this rotation only eats half of the overflow .. Ah I can increase the guard band.
So now, all vertices are on screen and even the horion edges have different signs on the corners.
As I discuss with the BSP, the cut points will be rounded. Vertices will be sorted into the BSP perfectly. Edges may not:
First edge is clipped on root.
then edge is clipped on child. The cut vertex cooridnate makes it look like it is fully in one grand child, but in reality it is not.
After the BSP tree is done, each edge needs to gain a width. I don't have two disjunct types here: portal vs solid. No, everything is soup. So how do I deal with it?
z comparison acts on sectors .. I can use the split horizon to be implement tolerance
so after bsp .. edge may have gaps
    return to axis-alignment errm y sort per room. x order switch on scanline. I only need one cut .. not 3. Compare it with scanline is 8 bit * denominator (32 bit (area spanned by slopes) )
        this is not too bad (compared to checks on 16 scanline on average). And it works for slithers. Ah, basically rounding creates DMZ. When 3 cuts are between 4 pixel rays, we don't care. Creative use of fractions and floats does not give us this.
    So, BSP is back. Tree became natural and organic again.
    Rooms are used to fill this tree in a way to keep heuristic. Portals are as effective inside a tree. It would be a liberating feeling to use 90° FoV in 3d and let BSP handle the rest.
    Looks like the BSP tree cuts are the ones which don't need any correction (unlike the my MVP with simple rectangle borders: the 3d clipping). BSP is the correction.
    Is flowing over the bounds of a portal possible? Rectangle checks by ray tracing. I may need to to this on the outside pixels. So for each vertex, check the signs of its edges.
    If I have those outer bounds around in 2d space, I can project them back into 3d. These are tighter than just expanding the edges. So I fight overflow right from the start (for slither portals)?
    Ah, so these pixels are used only ones ( no bean counting here ), but they allow me to keept overflow inside the 1px "guard band".
    Good thing is: This works with scene graphs. No matter how much I like the infinite precision for levels, the z-buffer on Jaguar is just broken. And I hate those Wing Commander I slow downs.

*/
/**
 * My code already calls methods on vectors. So I could probably come up with a small set of operations which will be called (back) from the data flow graph.
 * If I go full precision, I can have flat n-gons ( like Doom ) in a scene graph. Matrix multiplication appears here ( and in a limited way in UV mapping (I should pull the feed-through out of the Matrix))
 * Keep in mind that I don't use full precision for physics or even frame to frame iteration. I stick to a single frame for the MVP. And scene graphs also don't need full precision. Just the nodes need to be consistent so that walls of houses stay flat as do the windshield and hood of a car. Or its plate. IMHO warping on n-gons gives this typical Jaguar (Skyhammer) early PC underdog 3d games () look. Doom ressurection on 32x ?
 * Bezier curves or similar for roads: Efficency says: transform the control points. Then tesselate in camera space. I like twists: Road needs triangulation anyways.
 * Usually, fixed point ease the calculation. With infinite precsion, the "exception" to add more bits is so expensive that floats makes sense
 * Vectors need to be floated as a whole to be able to use MAC. The rotation matrix is 15 bit so that I don't have a special case with the normalisation of vector lengths. So I can use it right away for other math.
 * It does not matter if it is slightly above the norm because both factors will be approx 1/2 below max abs value. 3d math only adds 3 values max. So 1/4 + tolerance avoids any overflow.
 * float vertices are kinda logical. The clipping introduces the normalized vectors of the beam planes. The exception I identified is when the camera is close to long edge, but both vertices are far away.
 * How does the code throw this : I probably need to look into the code. vertex:slope : slope may throw because small camera movement changes it. This is before any division: just (vertex-camera) x edge
 * so the lower bits of vertex may need to be rotated, too. To preserve flat n-gons, the first vector needs 46 bit precsion. We don't care. Just implementing the throw is expensive (code size, coding). Doing it twice not so much.
 * Horizon is not really more difficult. Screen filling floor is similar.
 */
/* JRISC/42   aka Divide by 42 bits
The remainder register may be read after the divide has completed, this value in this register may either be
positive, in which case it contains the actual remainder, or negative, in which case it contains the remainder
minus the divisor.

Uh this costs some cycles. How do I deal with more bits in the divisor? Pentium says: Do an estimate with low precsion. Then multiply the full precision. Divide the remainder.
I think that we can prove that the remainder only changes the result by a small ammount. Like: We don't have to repeat endlessly. Just once for more precision. Anyways: integrate in the precision pull
*/
/**
 * Going infinite precsion, the guardband and NDCs are off the table. Portals are a first class citizen. Exact cuts are calculated using the exception mechanism. The two step 3dNDC 3dpixel process is replaced by this.
 * I do it because it is fun. I do it because it profits from my short cascade of calculations. I like descent.
 * What about the miner robots in descent? Did I not opt for fast BSP and DMZ? No problem here: cuts are still only calculated with pixel precsion (DMZ), just there is no additional epsilon:
 * Once a cut comes too close to the border of the DMC, the precision ramps up. Same with edge tracers. For textures it is okay to know the start and end pixel.
 * In the atlas I don't accept fences which are not aligned. When I just round down the slope of either x or y, I can be sure that they don't expand beyond an x or y maximum value. Second system: I could add half of the rest to the start?
 */
/*
All the code uses portals and going clock-wise. No abs() tricks or bit-logic on signs. No delta_x or delty_y = 0 speed ups. All projected edges have projected vertices (DMZ)
Corner vertices are gone. XY property of "on the border" is not special anymore. Only thing may be that : vertex slope :  the slope is anchored only on one vertex. The other is only pixel precise.
Horizon still exists: slope+bias .

Ah, it is weird how I still embrace the DMZ for cuts . So: No area between 3 edges calculation ( which would be a shorter data path).
The real killer for using tolerances was that it seems to pull in normalization. I mean, I still like tolerances in general, but for vector graphics they look like a bad fit.
*/
/**
 * Epsilon: I can use only positive factors and then some adds to feed intervals through the calculation, but the idea of an exception is to make the trigger cheap. So I use a worst case of worst case so to say.
 * Still, this is derived from the interval calculation. Multiplication of scalars is precise, just afterwards we round to nearest ( needs an add ) ( not how slope in the blitter is rounded towards zero which needs a branch or SHR 15; ADD)
 * The rounding errors of the factors add up in MAC. A scalar multiplication has 2 * input error + 0.5 final rounding error. Cross product has 2*2*input error. Inner product has 3*2 .
 * Propagation lets the tolerance rise exponentially. Like, after 3 operations we lost half of our bits. Makes no sense to proceed? The good thing: small triangle with short edges have a lower chance of triggering reevalutions.
 * Small triangles without clipping have a short cascade. Yeah, there is the check against the BSP, though.
 * And we always need to cull. Just, the culling result is binary and without error to propagate.
 * It makes sense to float the results of cross product. Matrix is almost normalized, not much happens. Inner product is scalar. Usually we care only for the sign? But when we use it subtract, then subtract at 32 bit (sign?), and then float.
 *
 * Is it kinda weird that feeding the tolerance throught the Matrix allows for flat n-gons and glitch free texture? Ah, and portals.
 * Yeah, on sane hardware, portals would only be a minor speed up and would be axis aligned ( see Tomb Raider ). Back projection is cheap due to the low number.
 * I read that the software renderer on Quake uses spans not unlike the column buffer on Doom. No idea how occlusion culling is to work with this, but it can help with the fill rate:
 * Funny thing on the Jaguar is that we could make an axis aligned tree and flip x and y direction. Possibly triggered by geometry. Span buffer is just no my cup of tea.
 * In contrast to scanline rendering, this would support portals. It sucks in b-trees or bucket sort. Ugly.
 */
/**
 Backprojection works like:  use slope ( 2d floated) z=0, vertex  , z= value given by field of view. Cross product => xz xz xy+yx rounding is in out budget if our pixels are not just rounded, but include 1px guard. They do include this on the screen border because we clip tigtly (some smaller epsilon) around the in screen rays.
 I think horizon is already a floated normal. But the bias shift follows from the vertex math. Take the wedge, normalize, multply with grad. I don't need precision. Floating would be good enough. Though fast inverse is very fast after said floating. low precision MUL is fast in JRISC.
 So really, I should not use pixel floor/ceil and epsilon. This will collide with the screen borders. The other way: epsilon and then rounding. I just don't like this kind of code here when infinite precision would not need it.
 */
/*
For z order I use the cut -> horizon. Then some math on which side of the cut which polygon is in front. So epsilon stuff just like for the projection. Clipping to avoid overflow also.
Z still is just like texture. I don't care about errors. Just, gaps between geometry are so much more ugly than z-fighting
And for the textures I should drop the Atlas. Oh wait: Without GL_REPEAT even transparent pixels may appear. So, for high quality graphics I need to move any result of the perspective projection into bounds. Same for delta*span length (integer division is actually exact here, no rounding happens within the blitter). Same if I ever plan to use the z-buffer for more than validation (problem of the horizon or some minor location shift letting us change sides).
This is really a reason to use screen space affine texture mapping. 15 bit delta for whole screen. Let's limit to small triangles: 12 bit delta -> 24 bit determiand . Ah rounding still does happen!
 */
/*
Beamtree with infinite precision is not really slower.
Looks like the code needs to be duplicated for screenSpace2d and worldSpace3d
For cascade portals in 3d, we need to check if 3 edges eclose an area clockwise  ( 2d rasterizer does not care, but that is far away)
can just as well do this before rotation for a wide dataflow. code stays almost as complex in sequence. screenspace would need rounding also
beam.normal = fromCamera x slope .   rotation=volume.sign = late product(normals) = (beam0 x beam1 = ray) inner normal
so infinite precision would be a graph: vertices -> normals -> edges -> signs . Each vertex has an index. The graph operators let us identify every node
MAC Output is 32 bit which can be stored easily. So rounding happens before.
To add precision, we just shift in the other direction. So at least here, double register shift is not missing for us.
There is still the problem of the sign. Sign affects the significiant bits! It cost lies in the default path. But then again it is just round: shift Addq shift  2 added cycles
So now we have to persist 48 bits. Data becomes bigger than all the linking indices. But for correction, we need the new 32 bits separately.
In the next step we get the the LH+HL and the LL outputs. Both 32 bit. Both better be persisted. But we feed along the LH. So I need a precision per node and one per edge.
Precision grow is the exception. I alread gathered all links from backtracking. I can easily allocate new ( larger ) nodes.
I feel like generic malloc needs a b-tree for the gaps. A fixed granularity could help. Ah, I should clear this buffer per frame. Or: move node from the start into the gap.
So this is still a queue. The wider high precision nodes are filled by two standard nodes. Like in the rare case that I have to increase precision twice.
Precision increase request backtrack. They stop when full precision is present at a node already.
With 24 bit world coordinates, perhaps I can backtrack projected vertices? With NDC there are 3 steps!
Bresenham has these changed signs, but otherwise? Too close to zero, reset the tracer/cursor like you would at a vertex. Use infinite precision here.
Of course, this does not really fit screen2d BSP for quick and dirty occlusion. On screen I can build the BSP roughly front to back, but draw back to front
Jaguar does not have much memory, but far less speed. I can keep this information. Then draw cuts 10% wider than necessary. Would still be ugly with translucency, but Jaguar has none.

vertex inner normal  ' works both ways
all products with three elements, but no bias. JRISC bias is slow anyways
behind camera : inner product with nose
    edge
    plane

vertex projection is good: edge tracer are limited to 16bit. 16*24
rounding errors everywhere: clipping with epsilon should avoid out of bounds draw. rasterizer just uses while y< and if dx>0

Since I cannot do portals perfectly in any way, I accept that the projection wobble, edge wobble and texture wobble lead to glitches
The edge loop is already quite fat, so detectin of abs()<epsilon would be okay.
    ray trace ( how about the signs? Ah, yeah make sure that in increases along x. Single ray? Difficult) => ray needs to check all edges of triangle
    ray trace would be 16(pixel)x16(rotation) + camera (32) signs with edges (infinite precision). Texture: later
        ray trace also would need the inverse transfomration matrix and I don't want Matrix inverse ( it makes the code hard to read).

Even is this may be slower ( I miss the simple screen border cuts ), I am very interested in the timing results.
Math debugging using self consistency ( the expressions are free of Matrix math where I always confuse rows and cols)
*/
/*
Game objects inside the level need a fast solution. So 2d BSP it is. Cuts are stored as 16:16. As with clipping on borders,
the order of cuts may be wrong when we compare two of them and (of course) use the original edge slope. On the border moving is simple, but still in 2s we could just swap pixels, ah no cascade.
To not grow the glit, a cut which lands outside the sector is just moved on the border. Shortest distance. Does it even matter? Divide by zero?
So this is inhertently glitchy. With 8bit screen resolution and 8 bit to hide rounding, an edge crossing the screen will have on wrong pixel?
But then again this glitch only happens when 3 edges nearly cross at the same position.
It only affects many pixels if these edges are also nearly parallel. NDC makes sure to use the full precision ( up to minimal value to stay compatible with ABS).
Cuts use relative position. So uh, still only 15 bit usable for me. DIV is unsinged, MAC is signed. What a mess. Costs 4 cycles.

With a scene graph, game objects coordinates don't even manifest in world coordinates (Collision boxes or spheres).
So how can I use a portal renderer to clip game objects? What about LoD NURBS? I like racing games. There I draw a lot of road, but solve collsions only at some location (and on the car: Only the wheel patches. bb with other cars bb. But cars are anchored on the road patches at this time. So most of the frames: no car-car collision checks).
Same for height field. I mean, MAC is fast, but there is still no reason to not combine transformations. Like, I don't want a global height field like in Magic Carpet! As a physicist, this is not my style.

Rough front to back ordering. Longest edge first. No BSP merge yet. Should already look okay. Unlike my thoughts about glitches in Tomb Raider,
the sorting here is only for performance. So I it is okay not to merge objects in levels. Just insert the object center z into the level z.
Descent levels are composed of convex polyhedra. So sorting is -- yeah well portal renderer. We sort objects by z and then draw the surrounding polyhedron then go through portals.

Ah scrap that. For meshes and height field it is more important to go over shared edges and vertices to create a compact BSP.
I don't even plan for huge height fields. NURBS with their smoothness may need special code anyways. NURBS have bounding boxes.
Okay, I see how large NURBS and height fields in a racing game me better materialize in a world. Then far way occlusion can indeed be solved using events and floats with epsilon (beware the camera rotation: Only allow this for pseudo2d game. I think on Jaguar we are allowed to provide a limited backview like the rear mirrors in a lot of old games).
*/
// interface Pyramid {
// 	//logic
// 	corner_count(b: number[]): number
// 	//vector
// 	corner_ray(corner: number): Vec3
// 	border_normal(border: number): Vec3
// 	is_edge_inside_corner(): number
// }
// // special case: All vertices are Corners, and all edges are null
// class Rectangle implements Pyramid {
// 	is_edge_inside_corner(): number {
// 		inside = bias
// 		for (let axis = 0; axis < 2; axis++) {
// 			if (this.FoV[axis] > 1) throw new Error("These factors only let the uses Fov expand a little inside the 45° pyramide from the coarse check")
// 			inside += corner_screen[axis] * this.FoV[axis] * cross.v[axis]       // So, how does this work with portals? Portals behind portals corners created by a cut between two edges (with rounded 16 bit screen coefs). The cut is not rounded
// 		}
// 	}
// }
// This is for future code to check per pixel "ray tracing" as an exception for abs(value) < uncertainty
class Uncertain {
}
// New
// we look forward -- no FoV>180 no matter the shape. So the most independet thing to do is first to check if line going through both vertices passes in front of us
// so the z plane is back because at least one vertex need to have positive z
// any line will be in positive z -> so this is no test . The actual test is at the end of this paragraph and rather expensive
// the portal is already projected. It is 16 bit. The polygon vertices are still 3d (and I want large z) so they are around 24 bit
// The multiplication is still kinda cheap.  16x14 sha 16x14 add  store the sign bit somewhere ( shr to remove other bits; shl packet to make space OR to combine)
// so we know through which faces of the pyramid the edge passes through .. candidates
// My check was to expand the edge and camera into a surface. The pyramid edges (rays) then have an elevation
// The edge passe through fades where the elevation changes. Why do we need candidates? Is it only to discriminate against vertex-border ? Probably was a stupid bug in my old(prior to portals) code
// Now how to I detect lines, whose surface cuts through the pyramid, but not the line itself
// One half of the surface lies in negative z. I can shot a ray along the negative z axis, just deviating minimally ( some normal projection stuff ) 
// Ah this is a double cross product? These feel weird. I converted these equations to cross and then subtract inner product
// camera x edge_slope => normal   . normal x cross slope => shortest direction from camera to edge .  If the z component is negative then cull!
// compensation formulation:    vertex[0].z - slope.z*(vertex[0 | slope ) / (slope^2)    // 24x24 MUL because it is in 3d  . The DIV becomes MUL , of course
// Even though BSP mergers may come. Probably (for low poly) 3d polygon into 2d portal will be the normal case. BSP MVP will add poylgons sequentielly. Multi-Edge rasterizer -> mostly binaray tree. The DMZ thing did not pan out yet, mostly due to slithers: 3 almost parallel lines. The only vailable solution is indeed infinite precision. We have all the coefficients in scratchpad memory. We just need to add the products of the lower bits ( signed with some overlap to postpone carry )
// OLD: I never start from a portal. Always scrren rectangle as start and then a cascade of portas. So Horizon edges at least end in On_the_border_vertices, which may help with debugging
class PortalFactory {
    screenBordersWithNoSpecialCodePath() {
        const p = new Polygon_in_cameraSpace(); // seems to be the most clean way to share code (constants ,) with rectangle
        return new Portal(p.FoV);
    }
}
class DMZ_corner {
}
// So it looks like this is pure mathematical code. Error propagation code will deal with special cases like 0 ( screen )
// all edges are derived from 3d vertices no matter if clipped ( they may end up clipped in a cascade portal or polygon ). Advantage: no branches of code paths
class Portal {
    // A portal needs slopes. Do I care if they are derived from vertices? I can pull in the explict code later
    constructor(half_screen) {
        this.edge_as_beams = new Array(5); // before something becomes a portal, it is either the screen border or a polygon which was clipped by another portal ( contains refs to slopes (no error propagation in the narrow sense) )
        this.pixelRay_portal = new Array(5);
        this.FoV = half_screen;
    }
    vertex_SideOf_Beam(Vertex_in_cameraSpace) {
        this.edge_as_beams.map(beam => beam.innerProduct(Vertex_in_cameraSpace));
    }
    ray_SideOf_Edge(ray, edge_as_beam) {
        const p = this.pixelRay_portal[ray];
        const s = this.edge_as_beams.slice(ray, ray + 1).map(r => ({ angle: this.karthesic_to_angle(r.v.map(o => Math.sign(o))), signs: r.v.map(o => Math.sign(o)) }));
        // from point of view of DMZ, slope needs to be negated
        s[0].angle += 4;
        s[0].signs.map(s => -s);
        for (let end = 0; end < 2; end++) {
            // pulling
            let corner = s[end].signs; // ref 
            // rotate to wrap
            let ordinate = 0;
            for (; ordinate < 2; ordinate++) {
                if (corner[ordinate] == 0) {
                    corner[ordinate] = corner[1 - ordinate] * (end * 2 - 1);
                    break;
                } //todo:return
            }
            if (ordinate > 1) {
                this.rotate(corner, end);
            }
            s[end].angle = this.karthesic_to_angle(corner);
            // exception : axis aligned slithers => invisible
        }
        if (s[1].angle < s[0].angle)
            s[1].angle += 4;
        const cursor = s[0].signs.slice(); // should I already convert to bitfields as I will for JRISC?
        // How exactly does the top-left rule look like? For axis aligned edges (polygon at higher values), a fraction of 0 means that we just reached the next higher integer .. so we just dodged the ray at exact pixel position. "Flooring rule"
        // If a portal and an edge behind it exactly cross a pixel, what does it mean for our DMZ. I mean the case where the wrap goes over 3 corners.
        // the portal edges may meet at the internal (far) corner. And the meet with the polygon
        // This would be the only case where the far corner even matters. Now it seems if this corner is on the lower right, it is inside the portal
        // if a polygon sneaks into the portal there, the same flooring rule applies and the ray does not hit
        // if a polygon ends there, the corner hits the polygon, but we don't need the edge for this.
        // So: we don't care for the internal corner. For the other corners we know that the cut with the actual edge not overflow -- ah no, we lost this property ( grazing incidence, slithers )
        // Grazing incidence will probably trigger precision issues when floating. Pure algebra. Sadly, the geometric connection is lost. Out of bounds crossings can simply be detected using integer ranges on x and y.
        // Geometric interpretation: Check over the (closed (because we don't know which DMZ border is crossed)) x or y interval. Axis alignment with camera space simplfies calculation.
        // the multiplication tests around the DMZ set up the precision pulled for edge slope and bias. The cut between the two edges need to use at least the same precision. This is probably expensive, but looks like the a mandatory cost. Real. Based on some underlying maths.
        // The calc y for two x or vice versa. Check if delta between both edges changes (last operation is XOR). Using fractions, this becomes multiplication.
        // Temporary values can be reused for checking forEachEach n-gon vs m-portal edges.
        // Special case of horizontal always exists. This would imply that two DMZs at the end of a portal edge share one intY value. So I already need to check there?
        // All cases with cut on integer x or y will give us a zero ( so sign is not that meaningful ). TopLeft rule again? Floor rule?
        // IMHO the portal vs polygon situation will make this edge irrelavant. It needs to be clearly inside at either y.
        // Closed interval hurts, we don't care about cuts in the DMZ. So just another "refinement" step :-(. Remedy: check inside corners of DMZ to find the border which is actually crossed.
        // Special case: All cuts in the same DMZ .. can this even happen? Otherwise this a closed interval. It is enough to check one range. Ah, I don't want to depend on the rasterizer, not even for a convention here. I need to check both, even for a closed intervall
        // Ah, DMZ becomes the old guad band all over again? I can only cull edges fast. It almost looks like I need to calculate all cuts with all portal edges for all passing polygon edges.
        // If the portal area (in real covered pixels -- consider for sithers an alignment! You need to rasterize) becomes small enough, I may switch to raytracing in Camera 3dspace.
        for (var angle = s[0][0]; angle < s[1][0]; angle++) { // todo: bring back cyclic, but in a clean way
            // check exposed corners of pixel DMZ
            const c = p.v.map((o, i) => (o + cursor[i] + 1) / 2); // top left pixel convention. So like, the offset needs to be >=0 . Is also memory management convention
            const v = new Vec3([[...c, 1000]]); // todo: Ah, here the z appears again. This has to match the relation between FoV 0.8 (mostly used to define aspect ratio) and FoV in pixels. The real (common FoV) is determined by the transformation into camera space.
            var collection = edge_as_beam.innerProduct(v); // collection is for debugging. We keep the whole number, not just the sign for this. Later shorten, but how much: still need to scan for two sign changes
            this.rotate(cursor, 0);
        }
    }
    rotate(corner, end) {
        const copy = corner.slice();
        for (let target = 0; target < 2; target++) {
            corner[target] = (1 - 2 * (target ^ end)) * copy[1 - target];
        }
    }
    // not only borders provoke funny sign bit logic, but pixel co-ordinates, too
    // along x should be angle=0
    karthesic_to_angle(sign) {
        // usual case encompass one exceptions
        if (sign[1] > 0)
            return 2 - sign[0];
        if (sign[1] < 0)
            return 6 + sign[0];
        // exceptions
        //if (sign[1]==0)
        return (1 - sign[0]) * 4; // <<2 JRISC    branches: ==1 ? 0 : 4
        //if (sign[0]==0) return sign[1] ==1 ? 2 : 6
    }
    // 2 or 3 item, 2 vertices
    classify23(items, v3, b) {
        items.forEach((item, i) => {
            let p3;
            // todo: switch
            if (item instanceof Corner)
                p3 = new Vec3([[...this.FoV, 100]]); // this is real. Corners don't need subpixel. But I will not invest in a separate code path
            if (item instanceof Vertex_OnScreen)
                p3 = new Vec3([[...item.position, 1000]]); // rounded, so a little cascade // todo 1000 is screen*(fraction=subpixel)/foV 
            const normal = p3.crossProduct(p3); // two vertices. => 32 bit !!! This is t After projection the wedge product is only 16 bit. Not just due to the removed z, but 
            // 3d vertex is 32 bit  , well 24 . What if a polygon is split by a BPS? I clearly only want this effort on the real, outermost portal. If I stick to corners I can save a lot of code
            const only_sign_matters = p3.innerProduct(new Vec2([v3.inSpace])); // vertex-camera -> vector !! Then stick to it
            // how much code is this anyways? Does 16x32 rotation give me signed vectors?
            // imult, imac, imac, resmac    3 of these
            // carry  (read this from bottom to top):
            //    cpy low,high
            //    SAR  15,high      // two register shift.                         the sign of the product of the lows
            // 	  signed low word assumes that its expanded sign bits are added to the high word
            //		CMP -1,low  single out sign  -- same as sub for carry     the sign left in the stored low result
            //		ADC low,high  // compensate
            // ; clean low
            //	SHL 17
            //  SAR 17   ( even the 16 bit factors pulled in by MUL need leeway for the carry inside MAC)
            //    imult low, 1   // this alone is not enough. Think of BigInt, not fractions. 
            //
            v3.outside_of_border |= 1 << b;
        });
    }
    // 2 or 3 item, 2 vertices
    cut23(item, v3) {
    }
    cut_wedge(item) {
        const vec2 = new Vec2([[2]]);
        const p = item.position;
        const w = [-p[1], p[0]];
    }
    // We calculate cuts because even the direct way doe it. just it only has one division
    // divisions are always the same cycles. So make them give us 16bit ordinates (8.8), which we need for the rasterizer anyway.
    // floats would be cool, but also difficult to debug. Perhaps local memory for data should be used to keep code size down -- so much norm add shift
    cut(item) {
        if (item[0][1] == null && item[1][1] == null) {
            if (item.map(it => it.reduce((p, i) => p && ((i == null) || (i instanceof Vertex_OnScreen)), true))) {
                // Just use 16 bit vertex coords
                // Trying to invert without actually writing this word here. Somehow express as wedge product and right multiplication?
                // Is this duality? Or axial vectors? The fact that math somehow makes me keep around slope and gradient vectors
                // for vertex -> border the item order around the polygon might not fit. Local reverse here!
                const slope = new Matrix2();
                slope.nominator = item.map(it => {
                    const v = new Vec2([it[2].position, it[0].position]);
                    // const grad=new Vec2([[2]])
                    // grad.v=[-v[1],v[0]]
                    return v;
                });
                const grad = new Matrix2();
                grad.nominator = item.map(it => {
                    const v = new Vec2([it[2].position, it[0].position]);
                    const grad = new Vec2([[2]]);
                    grad.v = [-v[1], v[0]]; // wedging . Todo check sign. Was this convention okay? Ah I think Bresenham breaks the sign anyway. So lets keep this convention because it feels natural in my head.
                    return grad;
                });
                // we always have grad. Sometimes form vertices, sometimes directly from horizon
                const vertex_involved_count = 1; // works for vertex-border thanks to reverse above
                // use wedge product to check if the vertices of the other edge are both on the same side. No dependency on rotation order
                // new . Todo: write as early out (classic for, extract into function, return) and also skip the edge
                // if one of the edges is horizon, us it for this and don't loop. If both are horizon .. uh the generic math problem . We cannot cull and it don't need to (to avoid glitches). We alredy checked if something is a horizon? Did we? Ah, only for the portal. The new polygon is .. uh so we check the vertices in 3d and 2d? 3d needs to be as precise to avoid . At least the portal is classified. The algorithm looks better in symmetric fashion.
                //  for the order of cuts, at least in 2d I already floated the slope ~= gradient for max precision and no influence from z. 
                // 3d edge vs Beam is problematic due to rounding. Even with reactangle I basically clip twice ( second time after rounding the slope ).
                // 3d vertex vs beam is possible, but imperfect. we get a lot of portal edge candidates. If I later implement BSP merging, I need symmetry anyways.
                // my symmetric pyramid clipping code feels like it has holes. I get candidate beam faces for cuts, but with vertices far on the side, all faces are candidates. Does this lead to glitches?
                // The beam edge cross polygon edge volume still gives me the actual face ( see corner code) . I don't understand how this could ever have glitched? Do I need to paint edges? Only case is when vertices are on the same side (see next code), but I extrapolated the edge. If I miss a corner, the corner traces will all ahve the sime size ( pyramid corner height over polygon "ground").
                let same_side = false;
                item.forEach((polygon, i_grad) => {
                    let point_of_view_found = false;
                    polygon.forEach(this_vertex => {
                        if (this_vertex instanceof Vertex_OnScreen && !point_of_view_found) {
                            point_of_view_found = true; // this allows for v-v  and v-s  for "this"
                            let side_p = 0;
                            item[1 - i_grad].forEach(other_v => {
                                if (other_v instanceof Vertex_OnScreen) { // I don't do it for "virtual" vertices because it would mean a chain calculation ( complicated (rounding) error propagation)
                                    const side = grad.nominator[i_grad].innerProduct(new Vec2([other_v.position, this_vertex.position]));
                                    if (side_p == side)
                                        same_side = true; // this is  return  for the algorithm, but how to express in funcitonal?
                                    else
                                        side_p = side;
                                }
                            });
                            if (side_p != 0 && !same_side) { // on_Screen  -slope-> border  fits in this code in nicely .   // this allows for v-v  and v-s  for "that"
                                const edge = null; // dummy. Todo fiddle with the indeces!
                                if (edge instanceof Edge_w_slope) { // while crafting the display list, the signs in slope have a meansing!
                                    const side = grad.nominator[i_grad].wedgeProduct(edge.gradient); // Not for horizon
                                    if (side_p == side)
                                        same_side = true; // this is  return  for the algorithm, but how to express in funcitonal?
                                    else
                                        side_p = side;
                                }
                            }
                        }
                    });
                });
                // new  				///// This code may duplicate some math, but it needs to stay readabl? 
                // so now, a slope vector  inner product  gradient vector  is 0 if with its dual, but wedge product if cross. I keep these arround for all edges of polygon and portal ( size of the total state of cuts() )
                // How do we describe a cut? There is this relative vector between the bases. Bias looks ugly
                // a cut is zero on grad is inner prod=> easy . But what is inversion here? How can xy be a result of two inner products ( the multiplication of the inverse matrix)
                // from algebra we know: xy = wedged,transposed &* gradient &* (bias=delta vector )
                // reverse reading
                // decompose delta vector
                let arg = item.map(it => it[0].position);
                const delta = new Vec2(arg); // cuts are stored per portal and polygon. For portal-polygon cutting, we have nxm delta. This is similar to how we compare each edge with every corner
                //  into parts orthogonal to each line   => gives us the abstract s,t coords similar to texture mapping
                const parts_carried_by_basis_vector = grad.mul_left_vec(delta); // not normalized     // return from here if any basis vector starting from VertexOnScreen is negative! How to share code with horizon? What is the equivalent ot the mul only check on the corners? It is the area between 3 cuts. So actually, do we really have to do nxm cuts with rounding? With vertex on screen, we can decide by the sign. Corner is a vertex on screen here ( OOP inheritance). Likewise vertices of the polygon need to be on different sides of the beam-plane.
                const de = grad.nominator[0].innerProduct(slope.nominator[1]); // determinant = denominator to normalize the parts vector. This obviously scales with the length of our basis vectors. The formula for inverse tells us that this is correct. Physics units would be m^2 and compensates both products
                if (de == 0)
                    return null;
                //const parts_carried_by_basis_vector=new Vec() ; // the vector space is 2d (s,t) + z + .. There is no norm defined and no cross product. Inner product works though?
                if (vertex_involved_count > 0 && parts_carried_by_basis_vector.v.reduce((p, c) => p || Math.sign(c) < 0, false))
                    return null; // cut is on the outside of either edge. Think of it as a triangle. Delta is the basis. Polygon order wants the cut to be corner C . Also need to point up both of them.
                if (vertex_involved_count == 2) { // using the other vertices. Same triangle argument. Somehow I feel like I should check both other vertices relative to one of mine if they are on the same side of me. This is just early out. Perhaps a way to test the code for the 3d case? Area between cuts sign should give the saem result. I just do this because cuts are really expensive (in JRISC). Code size is not even the worst aspect here.
                    let arg = item.map(it => it[1].position);
                    const delta = new Vec2(arg);
                    const parts_carried_by_basis_vector = grad.mul_left_vec(delta);
                    if (parts_carried_by_basis_vector.v.reduce((p, c) => p || Math.sign(c) < 0, false))
                        return null;
                }
                // add up the basis vectors    // this only needs a scalar factor per basis vector
                const xy_rel = Matrix.mul__Matrices_of_Rows([[parts_carried_by_basis_vector], slope.nominator]); // adding up vectors brings up back into the xy coordinate system. Matrix of Rows looks weird as static method
                const xy = xy_rel.nominator[0].scalarProduct(1 / de).apply(item[0][0].position); // I have 3 point types: 3d, 2d, ah and 2d with an interface for the rasterizer: integer_part_of_y_()
                return xy; // if we use (subpixel) correct screen coordinates, at least it is easy to debug the code ( which gives us the order of vertices ). My fear is the lack of bounds for almost parallel edges from polygon and portal. This would still be a problem because I always round. At least these are the real y for Bresenham. I can detect ovefflow as with the screen borders..Error calculation is straight forward and I could just have a multi-edge inner loop (exception) which takes the minimum on every line and stores the result for portal cascade or BSP merging
                // divide by determinand = cross wedgeProduct .. where does this sum come from? Ah, this is just the normalization from the step above
                // PS: Why don't we need per vector normalization here like in gram schmidt?
                //     The wedge product propagates the length of both factors . Gramm Schmidt in 3d is just different. Perhaps it is due to the fact that we acually normalize there. For orthogonalize we would use the cross product only, which would get unstable if basis vectors drift to different lengths. But here, the length mean something and we don't iterate so the glitch would be single frame.
                // Old
                // invert flipped andere diagonale als transpos
                // off diagnoal elements negativ
                // To be compatible with vector methods this can be decomposed into
                // wedging per vector (as part of Matrix)  . New method for vector
                // Matrix multiplication using inner products: matrix of ros  *  Matrix of cols  . result with self => 0 . others det=wedgeProd
                //const bias=grad.mul_left_vec( new Vec2( [(item[0][0] as Vertex_OnScreen).position,(item[1][0] as Vertex_OnScreen).position] )  ) 
                // inner product pulls into the value coord-system. Weird: so matrix is of rows of field and pos are col of field "trans"
                // value=gradient &* xy  . invers
                //xy.nominator.forEach((n,i)=> xy.nominator[i].v[0] /=de )
            }
        }
    }
    is_edge_inside_corner() {
        //if (typeof )
        //Portal
        //I don't want to solve the rotation order of multiple cuts
        //It seems the easiest (shortest code, modest time) way? What precision?
        //So all edges already lost their depth at this point. (bias and cross should be rounded)
        //So even without pre clipping on the rectangle, I use screen coords (vertex culling (each vertex on each pyramid face) makes this work in 3d with vertices having negative z)
        //So really, how do I calculate the area of 3 edges cutting?
        //usually, I do wedge product (two vectors) in 2d and cross,inner with 3 vectors in 3d
        //Algebra? So the cuts are: bias.sum()+ [coefs 2x2] &* [x,y]  solve for  [x,y]
        // => [xy] = swapped &* bias  /  (det==wedge product)
        // So from these points I gather two vectors and calculate cross product finally.
        // for point->vectors and for cross(*-*) I need to subtract, so a common denominator: a*b * b*c * c*a 
        // nominator doubles the muls +1 in cross. Priorr they are bias*swapped*extent^2
        // 9 = 1+ 2 *(4)
        // 9 - 5 = 4   -- uh, if I add units ( like metres ) to xy
        // actually, the coefs (swapped or not) are 1/metres.
        //  2 *  (m^(-1) * m^2) = m^2
        // so even after this check: A lot of multiplication!!!
        // I scribbled some images regarding DMZ. So first I round all crossings to pixel coordinates
        // But then there are a lot of ways how the deges can pass from one DMZ ( the square rigth below of floored pixel coord) to another DMZ
        // Lot's of ways to create bugs. I always pixture special cases, but thanks to rounding, I don't even know rotation order.
        // Instead of getting crazy with DMZ rules, and considering that I need pair-wise cuts rounded to pixel coords,
        // I can calculate the area using pixel coords. If it is small: test each pixel ( raytracing is my base => no problem with rounding )
        // So only slithers are a problem? So not actually take the area? All cuts within a rectangle between all rays is still an interesting case.
        // for the other: Check if we even need to decide by multiply all combinations of pixels around DMZ -- haha. Number of executed operations are back at full float.
        // 16 bit rounded cuts (compatible vertex on screen, also the result of DIV) with epsilon = max( width, height ). I need this cuts for the rasterizer. As seen above 16x16 is enough
        // with an area below epsilon, I could rasterize this as a triangle and store the result in the beamtree / portal so that there is a definitive portal.
        // this rasterizer has a fat inner loop: 3 edges at ones. bubble sort per line. Accepts the same payload and calls the same mapper.		
        return 0;
    }
}
//# sourceMappingURL=pyramid.js.map