
/* The Data and rounding oriented "industry way" of clipping failed me
Jaguar and plus/4 rather like unrolled code, branches, and parser generators
I will cherry pick from below.
*/

/*
Guard band / power of two between screen and NDC

This does not change that much. The screen border still triggers the use of the gradient most of the time.
I don't use projected vertices for edges so I don't use vertices projected into the guard band for edges.
The classification of the vertices itself internally takes vertex positions out of the guard band if available.
This does not even change too much .. but I think some rounding.

If all vertices and edges are outside of the screen, the polygon is either not visible or covers the whole screen.
The edge tests may have already utilized the guard band to narrow down to two cases, but the final decision does not depend on it.
We ray trace the (0,0,1) vector. The camera pointing direction. Alternatively: We check if the camera is above the plane ,xor, the camera points down.
Mathematically, this is the cross product of the span inner-multiplied with a vector from the camers (0,0) to any of the vertices.
Very few 32bit multiplications  in trade of extracting the results from one of the corners.
More a wide calculation instead of a sequence.

What is even the difference to the ray test? Ah, we don't care for all the edges. Ray edge intersection is the same maths. Hmm.
Readable code? Degenerate this is anyway. Either I choose two spans from the polygon for the normal, or one vertex of the screen.
Perhaps, based on vertices, I don't check all edges against one screen corner. Shortcuts.
Even in a BSP, I only need to check the vertices which lie on the splitting plane.
I could even acknowledge the convex polygon. Then each vertex is checked against each portal edge.
If we can apply the separating-axis theorem, we don't need to check the polygon edge against the portal corner.

*/

/**
 * Regarding occlusion culling I seem to have two alternatives. After clipping to frustum in screen space even older hardware can give me 16 bit per ordinate, so 8.8 fixed point.
 * Yeah, 8 bit hardware may really need to stick to adaptive precision integers. So if I dual release plus4 and Jag?
 * It is not really a beam tree then anymore. Just a 2d tree. Binary area subdivision.
 * Without more precision I cannot subpixel decide on the circular order of cuts. Everything will have to be rounded first.
 * We only care about the rays, not the space between. These BSP unsuited areas become child nodes in the tree.
 * I still seek a general Theory where a profiler changes from tree, to scanlines with spans, to z-buffer ( at a small enough are, this will be fastest. Though it costs code size.
 * 
 * Realy, with normalized deviced coordinates we only need DIV 16,16 . Only the vertices of the edge are 16 bit. Frustum is "1 bit". So we get the cutting position along the edge by 16/16 .
 * Then to get the position along the frustum we multiply with 16. (16*16)/16 is possible in most ISAs . It feels weird because we only want 8 bit .. ah for subpixel correction the OpenGL way, we want 16 bit.
 * This does not work with edge to edge. So even if we don't compare 3 edges for the hole they make, we run out of precision on some ISAs.
 * Edge to edge still have < 1px rounding error. So cut out a 2x2px quad. Quad is just a BSP. Bigger sectors become parents, small become children. 2x2 is quite small.
 * Within a quad for each pixel all edges are calculated. Z precision is less of a problem .. see z-sort.
 * Fall back and extra code? Infinite integers lead to the same code. So what is the advantage? With infinite precision I can use frame-to-frame coherence, which I find faszinating.
 * 1 cycle ( 2 cycles thanks to register file) MUL on JRISC makes scaling to pixels cheap. Ah, need a third cycle for SHR . For both cooridinates. So 6 cycles.
 * Maybe there is some synergy with the strange register layout of the address generator. It may be possible to keep values in the rotated position. Can still sort by integer y, right. For the triangle I mean.
 * Though, we should make sure to utilize AddQ.
 * 
 * Multiply from normalized to screen is cheap on JRISC. Funny. With special FoV it can be done with some Adds in other ISAs.
 * The original values are clipped at exactly 1000 ( some 0 ). So multiply with FoV will not need rounding. All non clipped vertices are rounded, but never draw over the frustum.
 */

/*
World space occlusion culling, really only makes fun with frustrum rotating in world space. No vehicles (not even polygon monsters) . Bookkeeping is not thaaat bad.
If I precalculate world space occlusion data structures like BSP or portals, I cannot allow rounding errors.
Though a loose bounding volume hierachy can specify padding which is good enough until the far plane.
This yields false positives but, would do something in camera space about this overlaps.
On the other hand it would be cool if vehicles -- even if we cannot enter them -- would solve self occlusion ( shadows ) internally first.
*/


// no native vectors in JS. Buffers are for large data (also called vectors)
// I need vec3 and only two products
// I don't want external dependencies of fat because I later need to compile to JRISC

export class Vec{ // looks like I need 2 and 3 dimensions to show off this (adaptive) linear approximation trick for textures after persepective projection 
	v:number[]
	innerProduct(o:Vec):number{
		let sum=0
		for(let i=0;i<this.v.length;i++){
			sum+=this.v[i]*o.v[i]
		}		
		return sum
	}
	
	innerProductM(o:Vec[],k:number):number{
		let sum=0
		for(let i=0;i<this.v.length;i++){
			sum+=this.v[i]*o[i].v[k]
		}		
		return sum
	}

	//constructor(points:number[][],len)
	constructor(points:number[][]){
		if (points.length<2){
			if (points[0].length<2) 			this.v=new Array<number>(points[0][0]).fill(0)
				else this.v=new Array(...points[0])
		}else{
			this.v=new Array<number>(points[0].length)
			for(let i=0;i<points[0].length;i++){
				this.v[i]=points[0][i]-points[1][i]
			}
		}
	}

	// no overloaded parameter in this critical part. JRISC can't overlaod anyway
	// in-place also not
	scalarProduct(f:number){
		let v= this.v.map( comp=> comp*f)
		return new Vec([v])
	}

	subtract(other: Vec): Vec {
		return new Vec([this.v, other.v])
	}
	
	add(other: Vec, weight?:number) {
		for(let i=0;i<this.v.length;i++){
			this.v[i]+=other.v[i]*(weight||1)
		}		
	}

	apply(other: number[]):number[] {
		const ret=other.slice()
		for(let i=0;i<this.v.length;i++){
			ret[i]+=this.v[i]
		}		
		return ret
	}	
}

export class Vec2 extends Vec{

	
	wedgeProduct(o:Vec2):number{
		return this.v[0]*o.v[1]-this.v[1]*o.v[0]
	}
}

export class Vec3 extends Vec{


	crossProduct(o:Vec3):Vec3{
		let v:Vec3=new Vec3([[this.v.length]])
		for(let i=0;i<this.v.length;i++){
			v.v[i]=this.v[(i+1)%3]*o.v[(i+2)%3]-this.v[(i+2)%3]*o.v[(i+1)%3]
		}
		return v
	}
}

export class Vec2_den extends Vec2{
	constructor(v: number[], den: number) {
		super( [v] );
		this.den = den;
	}
	den:number
}

class Frac{
	nom:number[]
	compare(o:Frac):boolean{
		return this.nom[0]*o[1]<o[0]*this.nom[1]
	}
	get_sign():boolean{
		return this.nom[0]<0 == this.nom[1]<0 
	}
}


export class Matrix{
	nominator:Vec[]
	constructor(cols?:number ){
		if (typeof cols == 'number') this.nominator=new Array<Vec>(cols)
	}
	static inverse(spanning2d: Vec[]) {
		throw new Error("Method not implemented.")
	}
	inverse(m:Vec[]):Matrix_frac{ // see applications. May need to pull back here for unit tests
		return null;
	}
	// Matrix with vector shoud usually use the inner product for fast implementation in JRISC MMULT and for nice mathematical notation ( as opposed to the SUM sign Sigma)
	// So here the right Matrix is seen as a collection of vectors. Somehow this works great to interpolate, but badly for rotation.
	// Thinking of column major for the vector. We store along columns, we mmult along columns
	// But obviously here, Matrix is row major, and the vector is considered trans.

	// inner product works well to let the camera coordinate system pull in world coordinates
	// this means that this Matrix has rows. So the vectors are rotated by 90° (transposed). Weird.
	// Rotating the camera coordinate system, cannot use the inner product.
	// But I just don't write it a Matrix. Just vector adds. So that I can skip some zeroes.
	mul_left(trans:Vec[]):Matrix{		
		let res=new Matrix(this.nominator.length)
		let k=0
		for(let i=0;i<this.nominator.length;i++){
			res.nominator[i].v[k]=this.nominator[i].innerProductM(trans,k)  // base would want vector add, while JRISC wants inner product
		}
		return res
	}

	// for some reason Matrix makes the code unreadable in many places. VertexId as Matrix dimension makes no sense
	mul_left_vec(trans:Vec):Vec{		
		let res=new Vec([[this.nominator.length]])
		//let k=0
		for(let i=0;i<this.nominator.length;i++){
			res.v[i]=this.nominator[i].innerProduct(trans)  // base would want vector add, while JRISC wants inner product
		}
		return res
	}

	// On the other hand, matrix multiplications is symmetric with respect to its operands. Vector.Inner_product feeld weird
	// This fits the A * A.inv() of SO3 very well
	// A * T(A) = 1
	// A*W_col -> C_col   ; T(A)*C_col -> W   <=> T(C_col)*A -> T(W) 
	// <=>
	// T(A*W_col) -> T(C_col)   ; T(A)*C_col -> W   <=> T(T(C_col)*A) -> W 
	// So I would store vectors in World space or Vectors in Camera space in different orientation? 
	// What if I never multiply two Matrices? ( I keep the division of the projection separated)?
	// I lose the symmetry. My code will be full of Transpose(). Ah no, Transpose is only for rotation .. nothing else. JRISC loves transpose. For others I could let the setter maintain the transpose.
	// BeamTree has only vector products. Texture mapping has inverse. Texture mapping is a beast: I need the product of the full projection matrix, the vertex interpolation, and the texture wrapping.
	// it goes like: Texel coordinate * texture rotation/scale * vertex position * rotation * projection .. and then inverse.
	// Inverse is slow. There is not point in swapping loops from inner to outer. No Transpose.
	// So weird that the unfied Vec4 approach of OpenGL has nothing on this
	// OpenGL goes forward over the vertices and then inverts on screen. They mix they near and far plane into this for the reason that linear interpolation without artefacts does not like large z dynamic.
	// So we do full precision z on the edge and then affine ( style of 1993 ). For sub spans, ah I get it. Interpolation is naturally an integer thing. We want to use the full machine integer range for this.
	// So both, texture subspans and z buffer, want the viewing frustum. It feels weird to keep dependencies for spans, like I would run along the span, and then suddenly will have to MUL to up the precision at one point,
	// or generally pull in more precision on a lot of.. But hey, grazing incidence is not suited to subspans. So I would fall back to full software and full precision, anyway.

	// Matrix multiplication cannot utilize inner product. It has to break up vectors of one of the factors.
	// Do we need transposed versions? This is used only for uv -> st mapping, so no.

	// uvz <- st <- viewVector  is pulling. So again, I use row major (Matrix of rows). It is an accident that rotation and texture mapping are both row major?
	static mul__Matrices_of_Rows(A: Vec[][]): Matrix {
		const row_count = A[0].length;
		const res = new Matrix(row_count)
		for (let row_i = 0; row_i < row_count; row_i++) {
			//if (row_i==row_count-1) console.log("mul row",A[0][row_i],A[1]) // debug
			const field_per_row__count = A[1][0].v.length  // 0=any
 			const row= new Vec([[field_per_row__count]])  // jagged array does not work here. The 90° rotate picture in my head for V=M&*V does not deal with the fields in the result well. My head cannot do multply from right like V=V &* M . I mean, there is no application in 3d graphics. Of course it is useful for eigen values for differential equations or the stress-strain tensor. But we are lucky, zero overlap with computer graphics here.
			for (let field_i = 0; field_i < field_per_row__count; field_i++) {
				if (A[0][field_i].v.length != A[1].length) throw new Error("Incompatible matrix sizes")
				for (let inner = 0; inner < A[1].length; inner++) {  // k inner ? inner loop? Encapsulated. Inner working?
					row.v[field_i] += A[0][row_i].v[inner] * A[1][inner].v[field_i]  // notice how indeces in second factor are interleaved. It looks like this transposed form is not natural for the application. So I have to transpose here.
					// for Vector Add, we want the last index select the component
					// So no matter what picture you have in your head ( row or column, left or right multiply),
					// Like in OpenGL Vectors would need to live in the right factor ( the inner loop ) as input
					// Output uses the other index
				}
			}
			res.nominator[row_i] = row
		}
		return res
	}
}

export class Matrix2 extends Matrix{
	override nominator: Vec2[]
	inverse_rn(result_row:number): Vec2_den {
		let m=this.nominator
		let det = m[0].wedgeProduct(m[1]);
		if (det === 0) throw new Error("Matrix is not invertible");

		let vd=new Vec2_den( [m[1-result_row].v[result_row] , m[result_row].v[1-result_row] ], det) ;  // Vectors are always vertical. Otherwise my head would hurt
		return vd;

	}
}

// So some engines don't seem to care, but I care about rounding
// Now for Doom or portal renderers I need infinite precision to avoid glitches.
// clipping to screen borders makes more sense after rotation ( even without normalized device coordinates .. because I clip a lot against portals and beam tree, Screen borders are nothing special)
// Quake PVS is also in world space. I now understand modern raytracing: Polygons in camera spacen, pixels in world space
// real ray-tracing would be if I round rays to world coordinates, but this will kill Bresenham
// linerp in the blitter does not even care.


/**
 * I switched the beam tree to sceen coordinates. The name is a bit misleading, but then again it is not because it replaces the z-buffer.
 * The back projection into real 3d is straight forward and allows me compare points to it before projection ( because I hate the arbitrary near plane),
 * and it allows me to clip lines to it ( even if one of the points is behind me ).
 * Now, do to rounding, the portals may not be convex anymore. The beam-tree then splits them up into sectors. Still can clip lines
 * Line clipping needs 32bit anyway. Might be the reason Descent appeared on 32bit 386.
 * 
 * I am a little unsure if 32 bit are really enough. Perhaps we should at an epsilon so that eh cutting point is outside of the portal for sure. Then clip again.
 * With the screen, the worst thing that can happen is that we have to decide at the corner what to do. But then the other ordinate is just the screen border after projection.
 * 
 * I looks like portals don't add much to a beam tree. When a portal is visble then we need to proceed with the room behind.
 * We should render all walls of the source room first. Any reason why we would not?
 * This visibility test in screen space is okay.
 * The interesting thing is that we take the part of the beam tree inside the portal to clip lines instead of the viewing frustum.
 * Does this give us any advantage? I mean, if clipping is not precise?
 * We could solve for y or x in screen space and use the .
 * I mean, I stopped wanting full precision for binary space partitioning trees.
 * But do? Sure for further comparision I only need pixel coordinates for points, but to get there, I need full precision lines
 * Ah, screen space BSP is 16 bit:  16x16 = 32 for checks. Then clipping a full precision line is 32x16 bit and still not that expensive.
 * Full precision already accepted the rounding due to rotation. No need for a convex projection.
 * Though, the math is: Normal of beam tree: first product. Inner product with points. Divide by square of edge length. Multiply with line.
 * I say: lots of multiplication and rounding.
 * View frustum culling on either guard band or normalized device coordinates is just a comparison.
 * I mention guardband because portals could use some smaller power of two bounding box on screen. And then we get away with one multiplication I think:
 * ( x0/(x1-x0) ) * (y1-y0) + y0
 * Of course it still is not perfect, but rounding does not change a sign of a component of the line vector!
 * Power of two screen borders shift one compontent before comaparing with the other. Almost feels like components should have their own exponent.
 * This 32bit math does not reduce precision relative to the MUL based rotation. But: can it introduce glitches?
 * Probably, points need to only be clipped to one bounding box. Even lines. So a bounding box infects a mesh.
 * What about the portal itself? Its vertices belong to both meshes.
 * Ah, we just need to round each float vertex to less than 32 bit. We could go down to 16, but then we would throw a little bit away. We could have smoother movement.
 * What about: 24 bit mantissa and 8 bit exponent? Then the mantissae in the vector components can shift by 8 and still not lead to rounding while clipping.
 * Rounding before the division .. Really? Division only does 24 / 16 = 24 ( 16.16 / 8.16 = 8.16). We have full 32 bit for the product.
 */

/*
Bounding boxes need an epsilon. I want the them tight in 3d, and add the epsilon in the projector. I need to add a line width? And corners get a pen shape?
So I project the points. Each point becomes a box. Then each line needs to know inside vs outside, and shift outside as far as possible on both boxes.
The boxes complicate the beam tree comparison.

This only sounds good with synergy with clipping. So find a bounding box on power of two frustum beams. Find overlap with the portal frustum.
Ridiculous. Just use bounding rectangles on screen. Seems like Jaguar has fast multiply, but glitch free occlusion requires a lot of bits.
Just say: Rectangle still better than viewing frustum. Use rectangles to check for visibility ( epsilon is easy ).
Then (optionally) set up a power of two view frustum. Clip project. Then clip again in screen space.
Of course, in this case, the bounding rectangle probably is not (much) larger than the screen. So we could just clip to screen borders.
The interesting case is when the portal is small, but the bounding box useless ( camera is in it). Like when we look out a window of an airplane.
Then the overlap is the portal. We still clip there, to be able to reject more vertices and in turn more edges.
*/

/*
A guardband for the whole screen would give me screen coordinates, which I still need to clip against the beam tree.
So the screen borders become special cases of the beam tree? Is it as fast as just 32x16 math? No, I still need that.
Multiplication in screen space is okay with using 16bit. So NDC -> Pixel does not really need the shifter trick. shifter works with quick value.
The shifter is always involved because we use floats ( or rather: fixed point factors). I cannot throw away 8 bits. But then often field of view is something close to binary.
Hmm. NDCs look less akward when rotating. Most factors then a close to 1. Skew is easy. Though comparison with other components is rather easy:

cmp a,b
Jump lessThan
neg a   ;delay slot
cmp a,b
jump lessthan

and b,b  -> sign  ( in MIPS or RISCV this would be simpler)

copy a,b
sub c,a
sar a,31
and 1,a
sub c,b
sar b,30
and 2,b

bit pattern

so for a line
xor p0,p1
count bits
=1? find crossing
>1? opposing? find crossings
	angled  ? calcualte "volume" aign aka determinant aks outer inner product with corner to check for passing
	
Bit patterns for polygons?
All vertices on same side border ? -> done
	or check x pattern  00 00 00 or 11 11 11  ( comparison result with screen border)
	or check y pattern         dito

all edges and vertices outside, but polygon still visible? A raytracer would need to x| with every edge and pass inside all of them.
I already processed the edges. I know that they all pass outside of the corners. Uh, this approach sounds topological. How do I check that I go around?
		All volumes have the same sign. I could drop one corner of the screen. Result would still be true.

This assembly code would start to look really ugly if I try 3d beam clipping. Much less hard encoding possible. Interleave / assignment. Symmetry.

At least, a guardband allows me to stick to 16 bit for some clipping calculations.
When I see checkered flag and Iron Soldier, there are a lot of small polygons on screen.
This may even make it efficient to have an exception batch for lines going over the whole guardband and polygons covering screen + band.
Iteration is slow, but clipping could target the middle of the guard band. Then perhaps before rotation the direction is 16 bit. Then multiply with percentage of going to the other vertex.
This vertex then is float rotated like all others. Ends up in the middle of the guard band.
Just this gets a little weird for screen corners. Like I would raytrace exactly in the corner and get my s,t coordinates
*/

// Beam tree is so PVS like. I want it as graph and independent of rotation.
// How do I display this? With rotation I can draw the BSP on screen
// I should not care about the precision. I can switch the code later on, to use time coherence .. or even build bounding volumes for the camera
// All the math is 3d with some non-normalized vectors. But the edges can still be drawn on screen.
// So uh, okay fantasy world without rounding

export class Matrix_Rotation extends Matrix{
	// for rotation matrices this is the same as multiplying with inverse
	// I always multiply from the left ( MAtrix=rows aka row major ). Vectors are on the right and "vertical"
	// First version only uses vectors because beam tree has a lot of rays to trace which are not projected
	// I want to leak the implementation because I count the bits. It is research code!
	// transpose only confuses me with other Matrices
	// Looks like Quaternions and Rotation Matrix belong together, while other Matrices don't
	MUL_left_transposed(v:Vec):Vec{  // Rot Matrix in column major makes more sense as it pushes the coordinate system into world space
		let res=new Vec([[0,0,0]])
		for(let k=0;k<this.nominator.length;k++){
			for(let i=0;i<this.nominator[k].v.length;i++){
				res[i]+=this.nominator[k].v[i] * v[k] //.innerProductM(trans,i)  // base would want vector add, while JRISC wants inner product
			}
		}
		return res
	}

	// Controls rotate from left. Forward ray = transposed. After the original rotation. 
	// It only affects two oridinates
	// Only these need to be modified, but all be read
	// Only reason for this is here is this rotation!
	// The Camera is not rotated along world axes, but along the camera axes.
	// Thus the generator is multiplied from right. This allows me to add vectors.
	Rotate_along_axis_Orthonormalize(axis:number, sine:number[]){
		// rotate an normalize
		// orthogonal: 3 products. Correction is shared 50:50
		//let cosine=Math.sqrt(1-sine*sine)

		// Rotate by mixing two axes
		let n:Vec[] = []
		n[axis]=this.nominator[axis] // copy the axis
		for(let i=0;i<2;i++){ // copy the other two axes
			let others=[(axis+1+i)%3,(axis+2-i)%3]
			n[others[0]]=this.nominator[others[0]].scalarProduct(sine[0]).subtract(this.nominator[others[1]].scalarProduct((1-2*i)*sine[1])) // rotate the other two axes
		}

		// normalize
		for(let i=0;i<3;i++){ // left transpose = right normal? I do row major as normal. So second index [i] just goes through. Right index mates.
			const around1 = 1 - (1 / 2) * (n[i].innerProduct(n[i]) -1 ) // Taylor series in all its glory. Quake fast inverse square root. x^(-1/2) -> 1/2 * x (-3/2) v. At x = 1
			//console.log("around1",around1)
			n[i]=n[i].scalarProduct(around1)
		}

		// orthogonalize
		// Inner products
		let sums:number[]=[]	// So do I need a transpose?	
		for(let i=0;i<3;i++){   // between each pair of axes (only once)
			let j=(i+1)%3
			sums[i]=n[i].innerProduct(n[j])/2 // inner product    . 2 is for fair removal of the cross-talk
			//console.log("sums0",sums[i])
		}
		// compensate any "cross-talk" to first order
		for(let i=0;i<3;i++){
			let j=(i+1)%3,k=(j+1)%3
			this.nominator[i]=n[i].subtract(n[j].scalarProduct(sums[i])).subtract(n[k].scalarProduct(sums[k]))
		}
	}
}


export class Matrix_frac extends Matrix{
	denominator:number
/*  UV has no denominator .. super class suffices!
	mul(trans:Vec[]):Matrix_frac{
		let mf=new Matrix_frac()
		mf.nominator=super.mul(trans).nominator
		mf.denominator=this.denominator*trans.den
	} */
}


class Plane{
	anchor:number[]
	normal:Vec3
}

class Z_order{
	z_at_intersection(e:Vec3[], anchor:Vec, normal:Vec):Frac{

		let beam=e[0].crossProduct(e[1]) // edges are planes with a normal in a beam tree

		// normal.inner(l*beam ) = normal.inner( anchor ) 
		let l:Frac
		l[0]=normal.innerProduct( anchor )
		l[1]=normal.innerProduct( beam)

		return l
	}

	// not really useful probably
	get_cutting_edge(p:Plane[]){
		let direction=p[0].normal.crossProduct(p[1].normal)
		let delta=new Vec3([p[0].anchor,p[1].anchor]) ; // hmm todo
		let dump=p[0].normal.crossProduct(delta) ;

		let reach=p[0].normal.crossProduct(direction)


		// v=direction+reach[0]+reach[1]
		// inverse 
		// transpose
		//let r0=v.innerProduct(direction.crossProduct(reach[1])) / spat
	}
}

class Edge{
	constructor( anchor:Vec3, direction:Vec3){

	}
}

interface Split{
	get_rotation(edges:Vec3[]):number
}

class AroundVertex { //implements Split{
	get_rotation(edge:Vec3, vertex:Vec3):number{
		return edge.innerProduct(vertex)
		// the normal of the edge may point in any direction
		// gather information on all coners of the screen and look for changes of sign.
	}
}

class Edges implements Split{
	get_rotation(edges:Vec3[]):number{
		return edges[0].crossProduct(edges[1]).innerProduct(edges[2])
	}
}

class Player{ // Location is reserved by JS TS // also used for collision // I don't want to call it "Object" // Atari 2800!
	position:number[] //Vec3
	rotation:Matrix_Rotation // this needs to be matrix. I tried to appreciate jagged arrays once and used vectors. It did not work out. Think of two dimensional array here ( C, C++, C#, JRISC) 
	// for our retro systems, position is already relative to camera (thanks to scene graph .. rotation comes later)
	// we already clipped ( backwards renderer as opposed to forward rasterizer? )
	get_Position(){
		return this.position[0];//-this.camera
	}
}

class Vec3_frac extends Vec3{	
	d:number
}

// in a beam tree we compare world edges against enemies .. no need to pull in the camera too early.
// but then it feels like ray casting here. Let's just call it a raycasting engine. Fits in with Wolf3d on Jaguar ( and maybe even AvP )
// I had a fear that rounding leads to gaps at vertices, but with beam trees I feel a little more safe.
// Beam trees may crash due to rounding .. no matter if forward or backward. I think even texture mapping in beam tree may lead to 1/0 due to rouding. Forward just cannot help anymore
// Simple solution is to saturate values after we rounded to polygon-height and span width/px.
class Camera extends Player{ // camera

	/*
	OpenGl has this projection Matrix.
	But in a Beam-Tree (with infinite integers) we have separate code for position, rotation, Fov-clipping, and pixel projection


	*/


	 screen=[320,240]
	 fov=256 // It hurts me that magic values help with float. OpenGL runs on float hardware and combines this into one Matrix
	// I need a start pixel of the polygon for the rasterizer
	// I know that it feels weird that edges and texture are then projected backwards	 
	scale:number[]

	constructor(){
		super()
		this.scale=[]
	}




	// // pre multiply matrix or not? 
	// private pixel_projection_texel(pixel:number[]){
	// 	var backwards_ray=new Vec3( [[ this.fov,pixel[0]-screen[0]+.5  , pixel[1]-screen[0]+.5 ]] )
	// 	this.rotation.mul_left([backwards_ray])  // I support both directions of rotations nativeley because that is how I think of them, generally (when solving equations, or physcs, or synergy with HBV). SO3 just does not have a common denominator in neither direction.
	// 	// something position?
	// }


	// private vertex_projection_pixel(vertex:number[]){
	// 	let forward_ray=new Vec3([vertex,this.position])
	// 	let fr=this.rotation.MUL_left_transposed(forward_ray)
	// 	let pixel=[ Math.floor(fr[1]*this.fov/fr[0]), Math.floor(fr[2]*this.fov/fr[0]) ]
	// }

	// very similar to Jaguar SDK. Guard band clipping only bloats the code.
	// actually, JRISC only has unsigned DIV. So we are forced to clip the near plane beforehand (no divide by zero). We are also forced to skew and make two sides of the screen axis aligned. Then again: clip using the sign.
	// Also to use full precision of DIV ( which sets no flags ), in fixedPoint mode, I need to make sure that the result does not overflow fixedPoint.
	// like 100 / .01 expands the envelope!
	// Actually we have no x much larger than z after rotation. The large part is shift before DIV.
	// To clip both other screen borders before the shift, we only MUL with 5 ( for 5*64=320 ) and 15 ( 16*15=240 ). So ADD/SUB SHL ADD. Ah oh just go ahead with MULT
	// OpenGL thinks that clipping is so very important and MMULT in such a way that it can clip at diagonals ( but no clipping to portals? )
	// using simple CMP or ADC, and move.
	// Transformation to screen space uses those small factors (1+4 and 16-1) and the SHL; DIV. 
	// short refresher: After transformation we don't store 1/z, but we subtract the far plane to use the whole scale (and that is the only reason: Memory is expensive!).
	// this gives us a far plane. I see how 1/z still has to be linear after this substraction
	// Perspective correction works by using W also for UV just as for the other coordinates. W is the unbiased Z and U and V have not been transformed.
	// private vertex_projection_clip(forward_ray:Vec3){
	// 	var clipcode:number[]=[]
	// 	for(let side=0;side<4;side++){
	// 		var pyramid_normal:Vec3
	// 		if (side&1){
	// 			pyramid_normal=new Vec3([[ side&2?-160:160 ,0, this.fov]]) //-160, -220 )
	// 		}else{
	// 			pyramid_normal=new Vec3([[ 0,side&2?-120:120, this.fov]])
	// 		}
	// 		let nr=this.rotation.mul_left([pyramid_normal]) // forward or backwards? I dunno
	// 		clipcode[side]=forward_ray.innerProduct(nr[0])
	// 	}
	// 	var plane:number[]=[] // near and far
	// 	clipcode[5]=forward_ray[0]-plane[0]
	// }

	// Todo: Find my text about this. I only use rotation matrix to be able to debug this
	// BeamTree language. Precision is no problem
	edge_clip(origin){
		// planes form a BSP, which breaks symmmetry
		// we go down the BSP. As long as both vertices fall into the same child, no problem
		// and edge is split each time we go down a node
		// we use the backwards vectors in the corners of the screen ( and near an far) and one base of the edge and the edge itself
		// to determin in which child of the BSP the cut ends up
		for(let x=0;x<2;x++){
			for(let y=0;y<2;y++){
			}			
		}
	}

	triangle_clip(){
		// BSP again
		// all vertices .. okay
		// edge cuts .. okay
		// we now only care for the frustum, no other child in the BSP
		// when we cut in a new plane in the BSP, now the roles are reversed. The inner-BSP edges can stick through the triangle
		// actually it would make more sense to have the triangle-cut edge within a BSP tree
		// when a new plane goes it, its cut within the concave sector may cut with the other cut
		// it is a 2d problem. Cut happens when seen from each edge, the other has vertices on both sides.
		// Ah I see, how I avoided the fractions in the past
		// the 3d way is to form volumes with all edges in clockwise rotation. All positive: we are in.
		// Though at this point we need this decision only for triangles which cut of a 3d (rear) corner of the frustum.
		// With more viewing distance than level loading, pure topological arguments suffice. I thinkt that is what I write in some text somewhere in this project.
	}

	denominator:number
	// set_rotation(r:Vec3[]){
	// 	this.rotation=r
	// 	this.inverse=new Array<Vec3>(3)

	// 	for(let i=0;i<3;i++){
	// 		var t=r[(i+1)%3].crossProduct(r[(i+2)%3])
	// 		for(let k=0;k<3;k++){
	// 			this.inverse[k].v[i]=t[k]
	// 		}
	// 	}
	// 	this.denominator=r[2].innerProduct(t)  // For rounding and FoV / aspect ratio (no normalized device coordinates)
	// }

/* 	// top left rule  helps us: We don't change rounding mode. Ceil, Floor, 0.5 is all okay. Only 1-complement cut off ( towards 0 ) is not allowed. So be careful with floats!
	transform_vertex_forwards(ver:number[]):Vec3_frac{
		this.mul
		let screen=new Array<Frac
		y=div // for for loop across scanline
		// for Bresenham
		nominator[]
		z=
	}

	// todo: some weird OOP pattern to shift direction of transformation. Mix with a custom number type which can be fixed, float, variablePrecision

	y_at_intersection(e:Vec3[]):Frac{
		if (e[0].id==border_top) {y=border_top;return} // portal renderer  or  even BSP with coverage-buffer wants this

		let beam=e[0].crossProduct(e[1]) // edges are planes with a normal in a beam tree
		this.transform_vertex_forwards(beam)

		beam[1]/beam[2]

		return l
	}

	get_spanX_at_y_clipped(edge:vec3,y:number):number{  

		// so backward forward? This works for clipped edges. This is similar to the texture-mapping short cut. It is important for the variable precision graph.
		transform()
		let normal=x[1] cross x[0]
		// non-normalized  device, so we can just
		view_ray.crossProduct(normal)
		// first scanline ys

	}

	get_spanX_at_y_vertices_on_screen(edge:vec3,y:number):number{  
		let x= 2 // first scanline
		// I should prefer forward to stay in line with OpenGL
		let slope=x[1]-x[0]  
	
		// both also as integer
		x_int+=slope_int+bresenham(slope_frac) 

	}

	transform_edge_forwards(ver:number[][], screen_border_flags:number ):vec3{

	}	 */
}

class Point_Tex2{
	point:number[]
	tex:number[]

}

// class Texture{ // similar to (clipped) edge
// 	p:Polygon_in_cameraSpace // reference .. bidirectional .. I may need to pull some data like base:
// 	base:number[] // texture (0,0) in space .. So not so great for environment mapping, but really great later maybe for triangles which are extended into perfectly flat, not necessarily concave polygons
// 	// Material texture (tiles) should not be squeezed .. but UV unwrapped organic texture (globe) needs to
// 	spanning:Vec3[]
// 	innerLoop:number[][] // scree{x,y} -> u v denominator  // the dependency graph may depend on clipping. The form of the function is independent from it.
// 	constructor(vertex:Point_Tex2[]){ 
// 		if (clippling){ // point array count=2  // important for level . Perspective correction is mandatory to differentiate the Jag from 3do and PSX
// 			this.base=vertex[1].point

// 			// inverse within a plane at least gives us a more simple determinant in the denominator .. hm lenght(cross product) . So somehow we now have a square-root here?
// 			// nominator xyz * innvers = uv  . not square.
// 			// linear equations. It does not help to omit the normal. Just cut off the line of the matrix in the end.
// 			/*
// 				Here is the geometric version
// 			*/
// 			for(let i=0;i<2;i++)
// 				this.spanning[i]=new Vec3(vertex.slice(0+i,2+i).map(p=>p.point))
// 			let camera:Vec3
// 			let normal=this.spanning[0].crossProduct(this.spanning[1])   // length should not matter .. inverse does not care. 
// 			this.spanning[2]=normal // feels as silly as the 1/z in the forward path . This screams for float .. or at least reinforces the fact that edges in a level should be about 1m long. 1mm cammera precision, 1km level ( or viewing distance??)
// 			//let hasToBeCoverdBy1=this.spanning[0].crossProduct(normal).innerProduct(camera) // just the inversion equation (transpose is a bit hidden? With inner product here the other direction needs left multiply)
// 			//let denominator=this.spanning[0].crossProduct(normal).innerProduct(this.spanning[0]) // obviously gives 1 when needed
			
// 			// I need height anyway (whatever "unit"). So 3x3 inverse. Then transform both (same unit) camera position and viewing direction into this. Then triangle divide as in checker board.
// 			// The normal is hence justified. Maybe I could compile the level and find small normals.
// 			// multiply with spanning UV

// 			// inverter , check for normel.cross => early out 0
// 			// spanning is vectorAdd . We don't need to transpose. Inverse is already innerP.
// 			let inverse=new Matrix_frac
// 			for (let i=0;i<2;i++){
// 				let v=this.spanning[(i+1)%3].crossProduct(this.spanning[(i+2)%3])
	
// 				inverse.nominator[i]=v //.inverse(spanning2d)
// 			}		
// 			inverse.denominator=inverse.nominator[0].innerProduct(this.spanning[0])	// count down in the loop above to have the values in registers
// 		}else{ // imporant for high detail enenmies and affine texture mapping on small triangles
// 			/*
// 			2d 
// 				spanning Points
// 				invert  . Only place with 2d invert
// 			*/
// 			if (affine){ // check if (delta z^2)/2 * (x+y ) < threshold ( value)  or cost : block division?
// 				let spanning2d=new Array<Vec>(2)
// 				for(let i=0;i<2;i++){
// 					spanning2d[i]=new Vec([vertex[i+1].point,vertex[0].point]) // temporary
// 				}
// 				let inverse=new Matrix_frac
// 				for (let i=0;i<2;i++){
// 					let v=new Vec([[2]])
// 					v[0+i]=-spanning2d[1-i].v[1-i]
// 					v[1-i]=+spanning2d[0+i].v[1-i]
// 					inverse.nominator[i]=v //.inverse(spanning2d)
// 				}
// 				inverse.denominator=0
// 				for (let i=0;i<2;i++){				
// 					inverse.denominator=spanning2d[0].v[0+i]*spanning2d[1].v[1-i]-inverse.denominator
// 				}				
// 				// todo: tests from CPU sim
// 				// UV
// 				for(let i=0;i<2;i++){
// 					spanning2d[i]=new Vec([vertex[i+1].point,vertex[0].tex]) // temporary
// 				}		
// 				let deltas=inverse.mul(spanning2d)

// 				//

// 			}else{
// 				// do I really want this?
// 				U=U/Z
// 				V=V/Z
// 				W=1/Z  // this looks so artificial compared to the other branch
// 			}
			
// 		}
// 	}
// }

// class Mesh{ // static
// 	// Left edge structure
// 	// BSP
// 	// recursion
// 	//// strict BHV
// 	//// accelerate rough front to back heap-sort ( or queue sort) 
// }
// class Level{

// }
// class Enemy{

// }
// class World{ // dynamic
// 	camera:Projector
// 	level:Level
// 	enemy:Enemy

	
// }