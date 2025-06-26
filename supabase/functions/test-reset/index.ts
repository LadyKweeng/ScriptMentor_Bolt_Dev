import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

Deno.serve(async (req) => {
  return Response.json({
    message: 'New function name works!'
  });
});
