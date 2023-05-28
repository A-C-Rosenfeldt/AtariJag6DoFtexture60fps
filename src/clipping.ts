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