// Dirección vieja de la TV: ahora la TV es /[iglesia]. Redirige para no romper links guardados.
export async function GET(request: Request, ctx: RouteContext<"/[iglesia]/tv">) {
  const { iglesia } = await ctx.params;
  return Response.redirect(new URL(`/${encodeURIComponent(iglesia)}`, request.url), 308);
}
