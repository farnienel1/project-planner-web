import com.google.firebase.rules.lang.FirebaseRulesProtoCompiler;
import com.google.firebase.rules.lang.CompileResult;
import com.google.firebase.rules.lang.common.FirebaseRulesLangOptions;
import com.google.firebase.rules.v1.Source;
import com.google.firebase.rules.v1.File;
import java.nio.file.*;
import java.util.*;
public class Compile {
  public static void main(String[] a) throws Exception {
    int warm=Integer.parseInt(a[0]), reps=Integer.parseInt(a[1]);
    FirebaseRulesLangOptions o=FirebaseRulesLangOptions.builder().allowTernaryOperator(true).build();
    List<String> files=Arrays.asList(a).subList(2,a.length);
    Map<String,long[]> t=new LinkedHashMap<>();
    for (String f: files) t.put(f,new long[reps]);
    for (int r=-warm;r<reps;r++) for (String f: files) {
      String s=new String(Files.readAllBytes(Paths.get(f)));
      Source src=Source.newBuilder().addFiles(File.newBuilder().setName("firestore.rules").setContent(s)).build();
      FirebaseRulesProtoCompiler c=FirebaseRulesProtoCompiler.createStandalone(o);
      long t0=System.nanoTime(); CompileResult res=c.compile(src); long dt=System.nanoTime()-t0;
      if (r>=0) t.get(f)[r]=dt;
      if (r==reps-1) { int n=res.getIssues().size(); System.err.print(""); t.get(f)[0]=t.get(f)[0]; System.out.print(""); if(n>0 && res.hasCompilationError()) System.out.println("ERR "+f); }
    }
    for (String f: files) { long[] x=t.get(f); Arrays.sort(x); System.out.printf("%-45s min %7.1f ms  med %7.1f ms%n", Paths.get(f).getFileName(), x[0]/1e6, x[x.length/2]/1e6); }
  }
}
