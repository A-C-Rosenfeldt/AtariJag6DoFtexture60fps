;Floats may be quite fast in JRISC. Tolerances are a great way to catch the few cases where they fail. The worst case for fixed point and fixed tolerances scared me

; 2-complement float

; inner product MAC

; Mantissa as usual
IMACN  ;only works on signed
MAC
MAC
RESMAC

copy
abs
NORMI    ; only works on unsigned
;find minimum ( for cross product )
abs sub add ..

add q
SHL     ; normalize . No rounding because I need all bits  ; Also probably not for inner products, but cross product

;Cross product output is expensive anyway, no shift?
;I cannot see a reason to shift on input. We just waste code on a loop over both inputs. Also my algorithm tends to reuse stored values
;I need to store all 32 bit. I do not need to store the sign dupes. There will not be many so get them out of the way and adjust exponent. Shift tolerance! Max of component influences share properites. So this happens basically at random.
;But mostly the result will be 32 or 31 bit. For the next operation I need tripple sign. SAR on input is as easy as it gets.
;Only viable alternative would be to store the two least significiant bits in a word together with exponent and tolerance. Seems cumbersome.


SHL       ; duplicated sign bit needed for carry if any cross products follow. Inner even needs triple
add input

;if I go for 14 bit mantissa for speed, I need to normalize (per component?? no!). This means that I need to store tolerances 
; normalized A is assumed to be worst case. Rounding error worst case. Tolerances are for a vector ( like exponent)
6 ADD tolerances, Vt   ;   The Add does Ab + Ba  with worst case (max abs value of -100000)   . 2 cycles. some trickery improves. But at least does not need abs() // see below
3 MAC tolerances, tt ;ab   ;is there any worst case? Do we stop if tolerance is above 2 times rounding? Seems arbitrary. Nice thing: All unsigned ( and small enough to be interpreted by MAC as such). So the real limit is: number of significiant bits in factor cannot drop to 0.
SH Vt
add Vt,tt
SH n,tt
addq 1,tt      ; Rounding needs to be explicit because it gets reduced by SAR further down in the pipe.








; inner product MUL

; Mantissa as usual
IMULT  ; components have individual signs, while the exponent is shared
IMULT ,A  ; manual says C:undefined  vs C:unaffected. 
IMULT
;copy
ADD A   ; binding via C prevents a lot of interleave -- but A and C interleave works!
ADC 0,
ADD A
ADC 0,C

; Catch overflow.  
copy C,sign
; abs does not work because 1111 is okay for negative numbers, but abs -> 1 .
AND mask,sign   ; waste a register compared to SH SH , but may in an inner loop? Also SH SH feels wrong
SAR sign
SHL C
cmp mask,a  ; copy sign bit
adc C       ; into bit 0
xor C,sign  ; look for changes
NORMI C,n   ;  ? shift to the right
cmp q,n       ; IEEE -> 16 bit  or whatever the next step needs. So not sure about q
Jump on  zero or negative  to  left

; blue collar 6502 code
ROR n,A ;Infinite precision would need to keep all bits  "underflow"
mfa mask
copy A,u
and mask,A 
not mask
and mask,u 

;shifter madness
copy A,u
addq n
sh n,A
addq n
sh n, u

;SHR n,A     ; register shift has the sign in the register, actually.
SUB bias, n
SHL n,C
OR C,A

Jump tolerances
left:
normi A
neg
addq
SAR A  ; why would I do this? compact storage? Vector fits into a phrase already. I would need to reduce precsion and also store it

; Mantissa normed on tolerance
tolerances:  ;components enter with rounded to nearest. -0.5 .. +0.5 is the tolerances symmetrically. Or rather +-1. Multiplication propagates as follows: Add the other factor. 
6 ADD all the components  ( interleave with two accumulators )
copy a0,a
copy b1,b
add a1,a
add b1,b
add a2,a
add b2,b
add b,a

;SH n,a   ; tolerance is unsigned  <- overflow

normi a   ; tolerance should bei 1 in 14.18 fixed pont
addq
add overflow
SH a
SH A      ; I abuse unnormalized mantissa to store the tolerance




; High precision tolerances
;What if we keep track of tolerances? Worst case
; (A+a)*(B+b)=  AB + aB + bA + ab  
AB +- ( aA + bB + ab )  ; we force symmetry
; Looks a bit like Hi low. Just that 32bit are not enough for me?
; a and b are small -> MULTN
copy A
abs   ; encoding only allows one register name. 


add n,exp ; normi is for conversion
neg n    ;  compensate   ; mantissa
add q   
SHL A   


NORMI A
add q
SHL A


SHL       ; duplicated sign bit needed for carry if any cross products follow. Inner even needs triple
add input



Store:




;fadd
;is super slow compared to add .  I need :   Vektor +  Vector * ( | )
;                                              32   +   16 * 16
;            all bits are stored for inf precision  +  inner product results can be stored at 16bit prec ( not 14 like cross)
;   same normalization like after cross product
; I think that pure add (sub) only happens once with the camera position and there wer are still using int. Anyways, rare. We don't mind the normalization
;so yeah, inner product output may be input of further calculations