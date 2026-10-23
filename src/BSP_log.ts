import { assert } from "chai";
import { Vec, Vec2, Vec3, CanvasObject, Edge2, Edge3, LogParallelLines, CanvasHelper } from "./clipping.js"
import { BSPnode_line_Beam, Polygon, Vertex_OnScreen } from "./BSP.js";

declare global {
    interface Array<T> {
        popFromTop(): T;

        // Source - https://stackoverflow.com/a/57913509
        // Posted by jcalz, modified by community. See post 'Timeline' for change history
        // Retrieved 2026-03-20, License - CC BY-SA 4.0
        map<U>(
            callbackfn: (value: T, index: number, array: T[]) => U,
            thisArg?: any
        ): { [K in keyof this]: U };
        //map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): { [K in keyof this]: U } ; //U[];
    }
}



//   (vertex) <--edge--> (vertex)             														log:  draw them all in their position . Color : orange
// can be logged using the line method of canvas. It is a bit dirty because I know that that method uses a math line internally, like I do
// I need this as a return type later


// expand edge into line using implicit function: dual vector for inner products. "bra ket"				
class Edge_beam extends Edge3 {
    line: BSPnode_line_Beam  // aka : normal in context of a beam, but I want line for the 2d BSP code.
    constructor(egb: Edge3 | Vec3[], marker?: string, l?: LogParallelLines) {     //  ? means optional here. So I guess it is not about null ( like in C# with all the ? ), but about 'undefined'
        if (egb instanceof Edge3) // If I ever go back to optional parameter: truely ?  Because I don't understand null vs typeof( egb )!='undefined' and ? seems to kinda gloss over it
            super(egb.vs, (typeof marker == 'undefined') ? "#bbb" : marker, l)  // null is fed through to actively block drawing, while undefined leads to default actions
        else //if ( typeof(egb) == typeof([Vertex_OnScreen,Vertex_OnScreen]))  // string comparison !? runtime !! Compiler does not need it
            super(egb)    // but why does this even compile?

        this.line = new BSPnode_line_Beam(this.vs)
    }

    // taken from BSP.ts . This is for portals / sectors .. not generic trees. Screen borders do not feel like a tree to me. Perhaps there are more applications (bounding box?) where the parents appear as a portal rather than scrambled edges
    ClipToPortal( verbose = true):Array<Vec2> {
        // this.toCanvas() // +random color 
        // CanvasObject.screen        

        let r: [number, number], last = 0, current = last, l = 0 //, last_v: Vec2
        const count_splits = 2
        let portal = new Array<Array<Vec2>>(count_splits) // We split the parent polygon into two -1 ==0 and +1= 1
        for (let i = 0; i < count_splits; i++) portal[i] = Array<Vec2>()

        const pi_eq_null = true // sector == null;
        if (pi_eq_null) {
            const count = 4
            var sector = new Array<Vec2>(count)
            for (let corner = 0; corner < count; corner++) {
                const gray_xy = corner ^ ((corner & 2) >> 1)  // check code in screen clipping for single polygon
                // cycle => xy   00 01 ! 10 11 ! 00
                //               00 01   11 10   00
                sector[corner] = new Vec2([CanvasObject.screen.map((s, i) => (((gray_xy >> i) & 1) == 0 ? 0 : s)-s/2)]) // one goal was to use explicit code to show the edge cases and allow logs and break points. So this code will stay and be amended by polygon (portal) code. 
            }
        }

        const ctx:CanvasRenderingContext2D = verbose ?  CanvasObject.ctx : null // CanvasRenderingContext2D,
        if (ctx != null  ) {
            ctx.strokeStyle = "#009"  // rafactor? "#FF0" :  mass test?  "#FF01"
            ctx.beginPath()
        }
        const cache = new Array<number>(length);// cache lazy infinite precision values
        const debugshift=5 // to do: add to CanvasObject and CanvasHelper
        const t = this.line.normal3d.v; // todo: move method into this.line
        for (let corner = 0; corner < sector.length; corner++) {
            var v = sector[corner]; // one goal was to use explicit code to show the edge cases and allow logs and break points. So this code will stay and be amended by polygon (portal) code. 			
            if (ctx != null && verbose) {
                // This is not the inner loop. If I want to remove branches, I need to optimize the compiler to unroll loops and implement those lag by one iteration variables
                //const v = new Vec2([cxy])
                co = [v.v[0] + debugshift+CanvasObject.screen[0]/2, v.v[1] + debugshift+CanvasObject.screen[1]/2] //;console.log("v",co[0],co[1])
                console.log(co)
                if (l++ == 0) ctx.moveTo(...co)
                else {
                    ctx.lineTo(...co)
                }
            }

            // project. This looks unclean, but is intended to debug / understand the cross product code
            // ah well, borders other than the screen will have have v[2]

            var xy=t[2]
            for (var i=0;i<2;i++){                
                xy+=t[i]*v.v[i]
            }

            current = xy //this.xy.innerProduct(v) + this.z  // todo: * v.z . inner product when corners are assumed to be vertices at a distance
            // const o=new Vec3([  CanvasObject.screen.map((s, i) => v.v[i]-s/2).concat(1) ])
            // current= this.normal.innerProduct(o)

            // on corner
            // let sign = 0
            // // Make JRISC behaves like this! Signed int2
            if (current < 0) { last = current;}// last_v = v }
            if (current > 0) { last = current; }// last_v = v }
            cache[corner] = current //JRSICbitfield32 |= sign << (corner * 2)   // *2 becomes <<1 in JRISC

        }
        if (ctx != null) {
            ctx.closePath()
            ctx.stroke(); l = 0
            const back = ctx.lineWidth
            ctx.lineWidth = 1
            ctx.strokeStyle = "#00B" // "#0" + variance.toString() + "F"; variance = (variance + 1) % 10
            ctx.beginPath()
        }

        last=cache[sector.length-1] 
        for (let corner = 0; corner < sector.length; corner++, last=current) {  // todo: polyon aka portal code

            v = sector[corner]
            current = cache[corner] //(JRSICbitfield32 >> (corner*2)) & 3
            //if (current == 2) current = -1 // 2-complement, aka Shift Arithmethic Right in JRISC and some high level languages
            //console.log("corner:"+corner+" last"+last+" current"+current)
            if (Math.abs(Math.sign(last) - Math.sign(current)) > 1) { // todo: bug does not work 
                cut=null
                if (pi_eq_null) {
                    // todo: reactivate this fast path. Perhaps bring back typed vertices
                    let cxy = v.v.slice()
                    const from_last = (corner ^ 1) & 1; //comming deom last
                    const from_corner = current / t[from_last] // signed
                    
                    //from_corner = current / this.normal.v[from_last]
                    cxy[from_last] -= from_corner

                    var co: [number, number] = [cxy[0] + debugshift+CanvasObject.screen[0]/2, cxy[1] + debugshift+CanvasObject.screen[1]/2]
                    if (ctx != null && verbose) {
                        ctx.fillStyle = "rgb(0, 225, 255)"
                        const hw=2
                        ctx.fillRect(co[0]-hw, co[1]-hw, 2*hw, 2*hw)
                    }
                    var cut = new Vec2([cxy]);
                    //console.log("cut",cut.v)
                } else {
                    // const edge = last_v.subtract01(v);
                    // let from_corner = current / edge.innerProduct(this.xy)
                    // var cut = v.subtract(edge.scalarProduct(from_corner))

                    // co = [cut.v[0] + debugshift, cut.v[1] + debugshift]
                    // if (ctx != null && verbose) {
                    //     ctx.fillStyle = "#288"
                    //     ctx.fillRect(co[0], co[1], 10, 10)
                    // }

                }

                const j=Math.min(1,Math.sign(current-last)+1)
                for (let i = 0; i < 1; i++) { // ???
                    if (typeof cut === undefined) console.warn("undef split")
                    portal[i][j]=cut //.push(cut)
                    //console.log( "border cut " + cut.v[0] +","+cut.v[1] +" @ "+j)
                }

                if (ctx != null) {
                    if (l++ == 0) ctx.moveTo(...co)
                    else {
                        ctx.lineTo(...co)
                        ctx.stroke()
                    }
                }
                // console.log("check for splits",co,last_v.v)
                const dummy = 0
                // It looks like there is no way around data oriented code as the portal is cut from the borders
                // placeholders seem to bloat code. Do not use in 2d. Perhaps merge with 
            }


            // Portal modificatio. Passt nicht so direkt zu BSP
            // if (typeof v === undefined) console.warn("undef passthrough")
            // if (current == 0) {
            //     for (let i = 0; i < portal.length; i++) portal[i].push(v)
            // } else {
            //     const i = (Math.sign(current) + 1) / 2
            //     if (i != 0 && i != 1) { console.warn("only two sides of a coin", i) }

            //     try {
            //         portal[i].push(v)
            //     } catch {
            //         console.log("portal", portal, i)
            //         const dummy = i
            //     }

            //     last = current// Hysteresis				
            // }

            // last_v = v  // ???
        }
        if (l > 2) {
            console.warn(" 2 < l== ", l, pi_eq_null)  // 0 happens pretty ofte !?
        }

        if (ctx != null) { ctx.lineWidth = 1 } //back
        return portal[0]


    }

}

type Children = [Edge_with_children, Edge_with_children];

/* cut back: edge intersection("cut") with borders . I need this for debugging. Make it real?			log:  color : blue for edge and borderCuts
*  endcap -- edge --    // with endcap -> [ vertex |  cut ]*/
class Edge_with_children extends Edge_beam {
    // Not the ends of the line. I think that I don't need them in the algorithm. Then I should not log them (yet). No phantasy data!
    // In the previous version of this code I tried to be clever with immutable, but here I try out plain old pointers
    ends: Vec3[]
    fix: boolean[]=[false,false] // todo trick with "ends" and "vs" one being null vs they being identical. Or keep separate because it is for logging only
    // so the problem is that I don't maintain cuts of extensions
    log_para: number  // number of parellel lines drawn in the graphical log
    child: Children = [null, null];
    constructor(egb: Edge_beam, l?: LogParallelLines) {
        super(egb, null, l);

        //this.ends = new Array<Vec3>(2)
        // So , I could no decide between tupels and some vector magic at first. TODO slice
        if (egb instanceof Edge_with_children) {
            this.log_para = egb.log_para + 1
            //for(var i=0;i<this.ends.length;i++)
            this.ends = egb.ends.slice();
            this.fix=egb.fix.slice()
        } else {
            this.log_para = 1  // I want to try display in same canvas as asset loader xor final display
            //for(var i=0;i<this.ends.length;i++)
            this.ends = egb.vs.slice();
        }

        // I need these for comparison. Or do I? The null check did not seem to fit the algorithm
        //for(var i=0;i<this.ends.length;i++)
        this.vs = egb.vs.slice();
    }

    // tree
    reach(prior: Edge_with_children) {
        var children = this.decide(prior)

        children.forEach((child, i) => {
            if (child == null) return
            var p = prior.child[i]  // argument
            // todo: extract this if-block as function for root to also it.
            if (p == null) {
                prior.child[i] = child
                Edge_with_children.toCanvasLine(child);

            } else {
                // todo
                child.reach(p)
            }
        })
    }

    public static toCanvasLine(child: Edge_with_children) {
        const dangling = child.ends.map((e, i) => child.fix[i] ?  null:e ); // reference compare (todo:check against dupes!!),  todo: get rid of joins
        const border_cuts = child.ClipToPortal(false); // todo: make method of .line  //.normal3d..tocavas()
        dangling.forEach((d, i) => {
            if (d != null) {

                const ctx: CanvasRenderingContext2D = CanvasObject.ctx; // CanvasRenderingContext2D,
                if (ctx != null) {
                    ctx.strokeStyle = "rgba(255, 255, 0, 0.39)"; // rafactor? "#FF0" :  mass test?  "#FF01"
                    ctx.beginPath();
                    const n = CanvasHelper.log_view(d.v, null);
                    ctx.moveTo(n[0], n[1]);
                    const b = border_cuts[i].v;
                    ctx.lineTo(b[0]+CanvasObject.screen[0]/2, b[1]+CanvasObject.screen[1]/2); // todo: unify with logview
                    ctx.stroke();
                }

            }
        }
        );
    }

    // math
    private decide(prior: Edge_beam): Children {
        var child: Children = [null, null]
        for (var j = 0; j < prior.vs.length; j++) {
            for (var i = 0; i < this.vs.length; i++) {
                if (this.vs[i] == prior.vs[j]) { // only one vertex should be shared. Otherwise I would have a dupe edge. Todo: check
                    this.fix[i]=true
                    const side = Math.min(1, 1 + Math.sign(prior.line.normal3d.innerProduct(this.vs[1 - i])))
                    child[side] = this; // this looks weird todo "admit themselves to the hospital"
                    return child
                }
            }
        }

        // cut
        var splitter = prior.line.normal3d
        const sides = [0, 0]

        for (var j = 0; j < this.ends.length; j++) {
            sides[j] = splitter.innerProduct(this.vs[j]) // splitter.decide(this.ends[j])
        }
        const s0 = sides[0] > 0;
        if (s0 == (sides[1] > 0)) {
            const side = s0 ? 1 : 0
            child[side] = this; // this looks weird todo "admit themselves to the hospital"
            return child
        }

        var l = new LogParallelLines()
        l.log_para = this.log_para  // pixels are small. Debugging steps are not smaller. Advance always. I don't like ticks, I mean aggressive rounding to make things look going step by step (easy)
        if (l.log_para>1 ) return child  // todo  only for debug
        l.normal = this.line.normal3d

        var cross = this.line.normal3d.crossProduct(splitter, l)  // this should log at para=1 ( odd/even)

        //var v=new Vertex_OnScreen(cross) // logging

        for (var i = 0; i < this.ends.length; i++) {  // the magic of pointers
            const c = new Edge_with_children(this) //, l)   // the original vertices are still one member acces operation . away // todo: why nothing on canvas
            c.ends[1 - i] = cross   // but the ends point to the correct object
            c.fix[1 - i]=true // for logging
            c.toCanvas(null,l)
            child[i] = c;
        }

        return child
    }

    toCanvas(marker:string=null, l?:LogParallelLines):void{ let ctx=CanvasObject.ctx //ctx: CanvasRenderingContext2D): void {
        const coords = this.ends.map(v=>CanvasHelper.log_view(v.v  , l));  // CanvasObject
        if (marker==null){
            var marker= "rgb(" 
            for (let i = 0; i < 3; i++) marker += (Math.round((Math.random() * 200)) + 55).toFixed(0) + " "  
            marker+=")";//"#" + cst + "2")  //??"#8e8"
        }
        super.toCanvasInner(coords,marker,l);
    }	    
}

export class BSPtreeLog {
    root: Edge_with_children = null  // isn't it 'undefined' otherwise?
    insertPolygonEdgeByEdge(p: Polygon, ID: number) {

        //const n = new BSPnode_perInsert(ID)
        p.es.forEach(e => {
            //let en = new BSPnode_edge(e)   not compatible with 3d math
            const b = new Edge_beam(e)
            const n = new Edge_with_children(b) // Node_CreateFromVecs(e, ID);

            // So I thought about DontRepeatYourself, but found no easy way out. This is a rather generic null check. I do it on root an leaf. Root is just different ( see properties ). The first edge loaded needs to go somewhere. I need an object in the loader: the tree.
            //  Yeah, C-strings are just a pointer to the first char, but we moved on to C++ and Rust. It is like this nasty default initialisation of properties. It is still KISS!
            if (this.root == null) {
                this.root = n
                Edge_with_children.toCanvasLine(n); // Todo: method of first argument
            }
            else {
                // reversed from collection notion (see signature above) because this.root is just the start of a chain of nodes glossed over.
                var child = n.reach(this.root)//, "rgba(0, 156, 204, 0.57)", false) // TODO check that the new vertices due to cuts are shown. Perhaps use the new types.

            }
        })
    }
}

/*
* 								
*  log:  wedge product: to draw parallels to depict the process how we instert the edge into the tree going down the nodes
*  log cuts .. so actually I do not care about lines or edges here. Even with regards to the color: colorize the endcaps to designate the type
*  log inserts: Though I care for the final insert as node into the tree. BSP nodes refer to lines (not edges). So the insert should be blue.
*  The line segment lives on the edge. I could draw it in a second window . Like if I do this all to remove hidden surfaces in vectors graphics without filling the faces.
*/

/*
Insert Face. Two panels in a row below the two edge panels.
I can fill a face in the log very translucent, I can just "redraw" the outline
face recognizes its edges. But would I not show insertion from root? Mark the node.lines that I touch.
Line where polygon falls on one side: grey
Line which meets the polygon  aka  the both belong to same edge: yellow   with endCaps drawn as points . Showing the re-collection of segments which had been split by other lines -- same which split the polygon..
Line which cuts through the polygon: red
    Splits internally to the polygon: For example if we started with small polygon in front. And it has many edges. And its BSP eats some of them with only two going outside.
    so it would be interesting to see red  edges (from the tree; not necessarily from the polygon) inside a polygon which has far less cut edges
*/