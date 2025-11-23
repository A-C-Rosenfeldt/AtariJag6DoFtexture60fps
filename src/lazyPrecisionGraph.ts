class FloatT{
    exponent:number
    tolerance:number  // unsigned
    mantissa: number[]  // 1  2=screen 3=space
}

interface OperatorJRISC3d{
    result: FloatT ;
    operate(args:FloatT[]):NodeWP;
    improvePrecision(args: FloatT[],base: FloatT[]): NodeWP
}

class NodeWP{   // name colides with node.js?  WithPrecision?
    precisionLadder: NodeWP[]   // 0=down, 1=up, nullabel items
    FirstConsumer: NodeWP
    Producer: NodeWP[]
    nextConsumer: NodeWP[] // per producer: link to next consumer (who also requested more precision)

    operator: OperatorJRISC3d

    operate(){
        this.operator.operate(this.Producer.map(pp=>pp.operator.result))
    }

    skontro: number[] // in operator only the correction of the result is stored (32 bit)
    // Due to the small 4kB scratchpad memory in the GPU, I have to split the rasterizer
    // so many times in the next stage, some operator may complain about lack of precision.
    // If I collect all, I only need delta. If I return to the previous stage immediately, I only need the high precision value


    pull_precision(){
        const n=this.operator.improvePrecision(
             this.Producer.map(pp=>pp.operator.result)
            ,this.Producer.map(pp=>pp.precisionLadder[0].operator.result)
        )
        n.precisionLadder[0]=this
        this.precisionLadder[1]=n

        const m=n.operator.result.mantissa
        // delta has smaller exponent than skontro. ToDo: implement 32bit limits
        this.skontro=this.operator.result.mantissa.map((a,i)=>a+m[i] )  // mantissa is not normalized and can accept delta within tolerance without changing exponent. Tolerance here is that of the delta value        
    }
}

class scalarMultiplication{
    distribute(){

    }
}

class InnerProduct implements OperatorJRISC3d{
    result: FloatT;
    operate(args: FloatT[]): NodeWP {
       
        this.operate_inner(args)

        const n=new NodeWP()
        n.operator=this
        return n
    }
    operate_inner(args: FloatT[]):FloatT {
        this.result.exponent=args.reduce((p,c)=> p*c.exponent,1)
        const eq=args.map(c=> c.mantissa.length) 
        if (eq[0]!=eq[1]) {this.result=null;return}
        const b=args[1].mantissa
        const ip=args[0].mantissa.map( (a,i)=> a*b[i] ).reduce((p,c)=>p+c)

        const t=args[0].mantissa.reduce((p,c)=>p+Math.abs(c))*args[1].tolerance //todo

        const de=Math.log2( Math.abs(ip)+Math.abs(t) )  // JRISC instruction is called NORMI
        if (de<0){
            //shift m and t
            this.result.exponent+=de
        }

        this.result.mantissa=[ip]   // result only has one item
        this.result.tolerance=t
    }

    improvePrecision(args: FloatT[],base: FloatT[]): NodeWP{
        // law of commutation allows us to pull out law of distribution out of inner and cross (and wedge) products
        // JRISC MAC loves it
        const fine=this.operate_inner(args)   // tolerances
        // medium
        for (let j=0;j<2;j++){
            let mantissa = this.operate_inner([base[j], args[1-j]]).mantissa;  // sum of bis
            fine.mantissa.forEach((c,i)=> c+= mantissa[i] ) // all have different expontent
        }
        // todo: exponent 
        return null
    }
}

class Graph_n_Track{
    nodes: NodeWP[]
    propagate_precision(){

    }
}