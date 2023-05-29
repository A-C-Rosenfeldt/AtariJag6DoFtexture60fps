// no native vectors in JS. Buffers are for large data (also called vectors)
// I need vec3 and only two products
// I don't want external dependencies of fat because I later need to compile to JRISC

class vec3{
	v:number[]
	innerProduct(o:vec3):number{
		// sum
		return 0
	}

	crossProduct(o:vec3):vec3{
		// sum
		return {v:[0]}
	}

	constructor(points:number[][]){
		this.v=[]
		for(let i=0;i++;i<3){
			this.v[i]=points[0][i]-points[1][i]
		}
	}
}

class frac{
	nom:number[]
	compare(o:frac):boolean{
		return this.nom[0]*o[1]<o[0]*this.nom[1]
	}
	get_sign():boolean{
		return this.nom[0]<0 == this.nom[1]<0 
	}
}

class Plane{
	anchor:number[]
	normal:vec3
}

class Z_order{
	z_at_intersection(e:vec3[], anchor:vec3, normal:vec3):frac{

		let beam=e[0].crossProduct(e[1]) // edges are planes with a normal in a beam tree

		// normal.inner(l*beam ) = normal.inner( anchor ) 
		let l:frac
		l[0]=normal.innerProduct( anchor )
		l[1]=normal.innerProduct( beam)

		return l
	}

	// not really useful probably
	get_cutting_edge(p:Plane[]){
		let direction=p[0].normal.crossProduct(p[1].normal)
		let delta=new vec3([p[0].anchor,p[1].anchor]) // hmm todo
		let p[0].normal.crossProduct(delta)

		let reach=p[0].normal.crossProduct(direction)


		// v=direction+reach[0]+reach[1]
		// inverse 
		// transpose
		let r0=v.innerProduct(direction.crossProduct(reach[1])) / spat
	}
}

class Edge{
	constructor( anchor:vec3, direction:vec3){

	}
}

interface Split{
	get_rotation(edges:vec3[]):number
}

class AroundVertex extends Split{
	get_rotation(edge:vec3, vertex:vec3):number{
		return edge.innerProduct(vertex)
		// the normal of the edge may point in any direction
		// gather information on all coners of the screen and look for changes of sign.
	}
}

class Edges extends Split{
	get_rotation(edges:vec3[]):number{
		return edges[0].crossProduct(edges[1]).innerProduct(edges[2])
	}
}

class Position{ // Location is reserved by JS TS
	position:number[]
	get_Position(){
		return this.position[0]-this.camera
	}
}

class Vec3_frac extends vec3{
	
	d:number
}

// in a beam tree we compare world edges against enemies .. no need to pull in the camera too early.
// but then it feels like ray casting here. Let's just call it a raycasting engine. Fits in with Wolf3d on Jaguar ( and maybe even AvP )
// I had a fear that rounding leads to gaps at vertices, but with beam trees I feel a little more safe.
// Beam trees may crash due to rounding .. no matter if forward or backward. I think even texture mapping in beam tree may lead to 1/0 due to rouding. Forward just cannot help anymore
// Simple solution is to saturate values after we rounded to polygon-height and span width/px.
class Projector extends Position{ // camera

	rotation:vec3[] // this needs to be matrix. I tried to appreciate jagged arrays once and used vectors. It did not work out. Think of two dimensional array here ( C, C++, C#, JRISC) 
	// for our retro systems, position is already relative to camera (thanks to scene graph .. rotation comes later)
	// we already clipped ( backwards renderer as opposed to forward rasterizer? )
	c:CanvasCaptureMediaStreamTrack;
	transform_ray_backwards(vec:vec3):vec3{
		for(let i=0;i<3;i++){

		}
	}

	mul(b:number[][],v:vec3):vec3 {
		for(let i=0;i<3;i++){
			inner
		}
	}

	inverse:vec3[]
	denominator:number
	set_rotation(r:vec3[]){
		this.rotation=r
		this.inverse=new Array<vec3>(3)

		for(let i=0;i<3;i++){
			var t=r[(i+1)%3].crossProduct(r[(i+2)%3])
			for(let k=0;k<3;k++){
				this.inverse[k].v[i]=t[k]
			}
		}
		this.denominator=r[2].innerProduct(t)  // For rounding and FoV / aspect ratio (no normalized device coordinates)
	}

	// top left rule  helps us: We don't change rounding mode. Ceil, Floor, 0.5 is all okay. Only 1-complement cut off ( towards 0 ) is not allowed. So be careful with floats!
	transform_vertex_forwards(ver:number[]):Vec3_frac{
		this.mul
		let screen=new Array<frac
		y=div // for for loop across scanline
		// for Bresenham
		nominator[]
		z=
	}

	// todo: some weird OOP pattern to shift direction of transformation. Mix with a custom number type which can be fixed, float, variablePrecision

	y_at_intersection(e:vec3[]):frac{
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

	}	
}

class Point_Tex2{
	point:number[]
	tex:number[]
}

class Texture{ // similar to (clipped) edge
	p:Polygon // reference .. bidirectional .. I may need to pull some data like base:
	base:number[] // texture (0,0) in space .. So not so great for environment mapping, but really great later maybe for triangles which are extended into perfectly flat, not necessarily concave polygons
	// Material texture (tiles) should not be squeezed .. but UV unwrapped organic texture (globe) needs to
	spanning:vec3[]
	innerLoop:number[][] // scree{x,y} -> u v denominator  // the dependency graph may depend on clipping. The form of the function is independent from it.
	constructor(vertices:Point_Tex2[]){ 
		if (clippling){ // point array count=2  // important for level
			this.base=vertices[0].point

			// inverse within a plane at least gives us a more simple determinant in the denominator .. hm lenght(cross product) . So somehow we now have a square-root here?
			// nominator xyz * innvers = uv  . not square.
			// linear equations. It does not help to omit the normal. Just cut off the line of the matrix in the end.
			/*
				Here is the geometric version
			*/
			let camera:vec3
			let normal=this.spanning[0].crossProduct(this.spanning[1])   // length should not matter .. inverse does not care. 
			let hasToBeCoverdBy1=this.spanning[0].crossProduct(normal).innerProduct(camera) // just the inversion equation (transpose is a bit hidden? With inner product here the other direction needs left multiply)
			let denominator=this.spanning[0].crossProduct(normal).innerProduct(this.spanning[0]) // obviously gives 1 when needed
			// I need height anyway (whatever "unit"). So 3x3 inverse. Then transform both (same unit) camera position and viewing direction into this. Then triangle divide as in checker board.
			// The normal is hence justified. Maybe I could compile the level and find small normals.
			// multiply with spanning UV
		}else{ // imporant for high detail enenmies and affine texture mapping on small triangles
			/*
			2d 
				spanning Points
				invert  .
			*/
			if (affine){
				Mul spanning UV
			}else{
				// do I really want this?
				U=U/Z
				V=V/Z
				W=1/Z  // this looks so artificial compared to the other branch
			}
			
		}
	}
}

class Mesh{ // static
	// Left edge structure
	// BSP
	// recursion
	//// strict BHV
	//// accelerate rough front to back heap-sort ( or queue sort) 
}
class Level{

}
class Enemy{

}
class World{ // dynamic
	camera:Projector
	level:Level
	enemy:Enemy

	
}