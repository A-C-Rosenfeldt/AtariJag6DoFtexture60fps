import { Vec3 } from "./clipping"

interface Pyramid {
	//logic
	corner_count(b:number[]): number
	//vector
	corner_ray(corner:number): Vec3 
	border_normal(border:number): Vec3 

}


class Rectangle implements Pyramid {

}

class Portal implements Pyramid {

}