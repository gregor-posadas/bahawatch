# minimal reader/writer for MapLibre glyph PBFs (glyphs.proto: glyphs{1:fontstack{1:name,2:range,3:glyph{1 id,2 bitmap,3 w,4 h,5 left(sint),6 top(sint),7 advance}}})
def rv(b,i):
    r=s=0
    while True:
        c=b[i];i+=1;r|=(c&0x7f)<<s;s+=7
        if c<0x80:return r,i
def fields(b):
    i=0;out=[]
    while i<len(b):
        k,i=rv(b,i);f,w=k>>3,k&7
        if w==0:v,i=rv(b,i)
        elif w==2:
            n,i=rv(b,i);v=b[i:i+n];i+=n
        else:raise ValueError(w)
        out.append((f,v))
    return out
zz=lambda v:(v>>1)^-(v&1)
def read(path):
    g={}
    for f,v in fields(open(path,'rb').read()):
        for f2,v2 in fields(v):
            if f2==3:
                d=dict(fields(v2));g[d[1]]=dict(w=d.get(3,0),h=d.get(4,0),left=zz(d.get(5,0)),top=zz(d.get(6,0)),adv=d.get(7,0),bm=d.get(2,b''))
            elif f2==1:name=v2
    return g
def wv(n):
    o=bytearray()
    while True:
        c=n&0x7f;n>>=7
        if n:o.append(c|0x80)
        else:o.append(c);return bytes(o)
def fld(f,w,v):
    if w==0:return wv(f<<3)+wv(v)
    return wv((f<<3)|2)+wv(len(v))+v
enz=lambda v:(v<<1)^(v>>31) if v<0 else v<<1
def write(name,rng,glyphs):
    fs=fld(1,2,name.encode())+fld(2,2,rng.encode())
    for gid in sorted(glyphs):
        g=glyphs[gid];m=fld(1,0,gid)
        if g['bm']:m+=fld(2,2,g['bm'])
        m+=fld(3,0,g['w'])+fld(4,0,g['h'])+fld(5,0,enz(g['left']))+fld(6,0,enz(g['top']))+fld(7,0,g['adv'])
        fs+=fld(3,2,m)
    return fld(1,2,fs)
