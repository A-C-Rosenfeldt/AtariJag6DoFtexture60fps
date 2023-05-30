// no native vectors in JS. Buffers are for large data (also called vectors)
// I need vec3 and only two products
// I don't want external dependencies of fat because I later need to compile to JRISC
class vec3 {
    constructor(points) {
        this.v = [];
        for (let i = 0; i++; i < 3) {
            this.v[i] = points[0][i] - points[1][i];
        }
    }
    innerProduct(o) {
        // sum
        return 0;
    }
    crossProduct(o) {
        // sum
        return { v: [0] };
    }
}
class frac {
    compare(o) {
        return this.nom[0] * o[1] < o[0] * this.nom[1];
    }
    get_sign() {
        return this.nom[0] < 0 == this.nom[1] < 0;
    }
}
class Plane {
}
class Z_order {
    z_at_intersection(e, anchor, normal) {
        let beam = e[0].crossProduct(e[1]); // edges are planes with a normal in a beam tree
        // normal.inner(l*beam ) = normal.inner( anchor ) 
        let l;
        l[0] = normal.innerProduct(anchor);
        l[1] = normal.innerProduct(beam);
        return l;
    }
    // not really useful probably
    get_cutting_edge(p) {
        let direction = p[0].normal.crossProduct(p[1].normal);
        let delta = new vec3([p[0].anchor, p[1].anchor]); // hmm todo
        let p, [];
        0;
        normal.crossProduct(delta);
        let reach = p[0].normal.crossProduct(direction);
        // v=direction+reach[0]+reach[1]
        // inverse 
        // transpose
        let r0 = v.innerProduct(direction.crossProduct(reach[1])) / spat;
    }
}
class Edge {
    constructor(anchor, direction) {
    }
}
class AroundVertex extends Split {
    get_rotation(edge, vertex) {
        return edge.innerProduct(vertex);
        // the normal of the edge may point in any direction
        // gather information on all coners of the screen and look for changes of sign.
    }
}
class Edges extends Split {
    get_rotation(edges) {
        return edges[0].crossProduct(edges[1]).innerProduct(edges[2]);
    }
}
class Position {
    get_Position() {
        return this.position[0] - this.camera;
    }
}
class Vec3_frac extends vec3 {
}
// in a beam tree we compare world edges against enemies .. no need to pull in the camera too early.
// but then it feels like ray casting here. Let's just call it a raycasting engine. Fits in with Wolf3d on Jaguar ( and maybe even AvP )
// I had a fear that rounding leads to gaps at vertices, but with beam trees I feel a little more safe.
// Beam trees may crash due to rounding .. no matter if forward or backward. I think even texture mapping in beam tree may lead to 1/0 due to rouding. Forward just cannot help anymore
// Simple solution is to saturate values after we rounded to polygon-height and span width/px.
class Projector extends Position {
    transform_ray_backwards(vec) {
        for (let i = 0; i < 3; i++) {
        }
    }
    mul(b, v) {
        for (let i = 0; i < 3; i++) {
            inner;
        }
    }
    set_rotation(r) {
        this.rotation = r;
        this.inverse = new Array(3);
        for (let i = 0; i < 3; i++) {
            var t = r[(i + 1) % 3].crossProduct(r[(i + 2) % 3]);
            for (let k = 0; k < 3; k++) {
                this.inverse[k].v[i] = t[k];
            }
        }
        this.denominator = r[2].innerProduct(t); // For rounding and FoV / aspect ratio (no normalized device coordinates)
    }
    // top left rule  helps us: We don't change rounding mode. Ceil, Floor, 0.5 is all okay. Only 1-complement cut off ( towards 0 ) is not allowed. So be careful with floats!
    transform_vertex_forwards(ver) {
        this.mul;
        let screen = new Array < frac;
        y = div; // for for loop across scanline
        // for Bresenham
        nominator[];
        z =
        ;
    }
    // todo: some weird OOP pattern to shift direction of transformation. Mix with a custom number type which can be fixed, float, variablePrecision
    y_at_intersection(e) {
        if (e[0].id == border_top) {
            y = border_top;
            return;
        } // portal renderer  or  even BSP with coverage-buffer wants this
        let beam = e[0].crossProduct(e[1]); // edges are planes with a normal in a beam tree
        this.transform_vertex_forwards(beam);
        beam[1] / beam[2];
        return l;
    }
    get_spanX_at_y_clipped(edge, y) {
        // so backward forward? This works for clipped edges. This is similar to the texture-mapping short cut. It is important for the variable precision graph.
        transform();
        let normal = x[1], cross, x, [];
        0;
        // non-normalized  device, so we can just
        view_ray.crossProduct(normal);
        // first scanline ys
    }
    get_spanX_at_y_vertices_on_screen(edge, y) {
        let x = 2; // first scanline
        // I should prefer forward to stay in line with OpenGL
        let slope = x[1] - x[0];
        // both also as integer
        x_int += slope_int + bresenham(slope_frac);
    }
    transform_edge_forwards(ver, screen_border_flags) {
    }
}
class Point_Tex2 {
}
class Texture {
    constructor(vertices) {
        if (clippling) { // point array count=2  // important for level
            this.base = vertices[0].point;
            // inverse within a plane at least gives us a more simple determinant in the denominator .. hm lenght(cross product) . So somehow we now have a square-root here?
            // nominator xyz * innvers = uv  . not square.
            // linear equations. It does not help to omit the normal. Just cut off the line of the matrix in the end.
            /*
                Here is the geometric version
            */
            let camera;
            let normal = this.spanning[0].crossProduct(this.spanning[1]); // length should not matter .. inverse does not care. 
            let hasToBeCoverdBy1 = this.spanning[0].crossProduct(normal).innerProduct(camera); // just the inversion equation (transpose is a bit hidden? With inner product here the other direction needs left multiply)
            let denominator = this.spanning[0].crossProduct(normal).innerProduct(this.spanning[0]); // obviously gives 1 when needed
            // I need height anyway (whatever "unit"). So 3x3 inverse. Then transform both (same unit) camera position and viewing direction into this. Then triangle divide as in checker board.
            // The normal is hence justified. Maybe I could compile the level and find small normals.
            // multiply with spanning UV
        }
        else { // imporant for high detail enenmies and affine texture mapping on small triangles
            /*
            2d
                spanning Points
                invert  .
            */
            if (affine) {
                Mul;
                spanning;
                UV;
            }
            else {
                // do I really want this?
                U = U / Z;
                V = V / Z;
                W = 1 / Z; // this looks so artificial compared to the other branch
            }
        }
    }
}
class Mesh {
}
class Level {
}
class Enemy {
}
class World {
}
