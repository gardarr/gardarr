/**
 * Exemplos de uso do CustomScrollArea
 * 
 * Este arquivo demonstra como usar o componente CustomScrollArea
 * com diferentes variantes e configurações.
 */

import { CustomScrollArea } from "./custom-scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

export function ScrollAreaExamples() {
  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Exemplos de CustomScrollArea</h2>
      
      {/* Exemplo 1: Scroll padrão */}
      <Card>
        <CardHeader>
          <CardTitle>Scroll Padrão (default)</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomScrollArea className="h-32 w-full border rounded-md p-4" variant="default">
            <div className="space-y-2">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="p-2 bg-muted rounded">
                  Item {i + 1} - Scroll padrão com largura média
                </div>
              ))}
            </div>
          </CustomScrollArea>
        </CardContent>
      </Card>

      {/* Exemplo 2: Scroll fino */}
      <Card>
        <CardHeader>
          <CardTitle>Scroll Fino (thin)</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomScrollArea className="h-32 w-full border rounded-md p-4" variant="thin">
            <div className="space-y-2">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="p-2 bg-muted rounded">
                  Item {i + 1} - Scroll fino para espaços compactos
                </div>
              ))}
            </div>
          </CustomScrollArea>
        </CardContent>
      </Card>

      {/* Exemplo 3: Scroll grosso */}
      <Card>
        <CardHeader>
          <CardTitle>Scroll Grosso (thick)</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomScrollArea className="h-32 w-full border rounded-md p-4" variant="thick">
            <div className="space-y-2">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="p-2 bg-muted rounded">
                  Item {i + 1} - Scroll grosso para melhor visibilidade
                </div>
              ))}
            </div>
          </CustomScrollArea>
        </CardContent>
      </Card>

      {/* Exemplo 4: Sem scrollbar */}
      <Card>
        <CardHeader>
          <CardTitle>Sem Scrollbar (hideScrollbar)</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomScrollArea className="h-32 w-full border rounded-md p-4" hideScrollbar>
            <div className="space-y-2">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="p-2 bg-muted rounded">
                  Item {i + 1} - Scroll invisível, apenas funcional
                </div>
              ))}
            </div>
          </CustomScrollArea>
        </CardContent>
      </Card>

      {/* Exemplo 5: Scroll horizontal */}
      <Card>
        <CardHeader>
          <CardTitle>Scroll Horizontal</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomScrollArea className="h-20 w-full border rounded-md p-4" variant="thin">
            <div className="flex space-x-4 w-max">
              {Array.from({ length: 15 }, (_, i) => (
                <div key={i} className="p-4 bg-muted rounded min-w-[200px]">
                  Card {i + 1}
                </div>
              ))}
            </div>
          </CustomScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Como usar o CustomScrollArea:
 * 
 * 1. Importe o componente:
 *    import { CustomScrollArea } from "@/components/ui/custom-scroll-area";
 * 
 * 2. Use com diferentes variantes:
 *    <CustomScrollArea variant="default">  // Scroll padrão (8px)
 *    <CustomScrollArea variant="thin">     // Scroll fino (6px)
 *    <CustomScrollArea variant="thick">    // Scroll grosso (12px)
 * 
 * 3. Oculte o scrollbar se necessário:
 *    <CustomScrollArea hideScrollbar>
 * 
 * 4. Aplique classes CSS personalizadas:
 *    <CustomScrollArea className="h-64 w-full border rounded">
 * 
 * 5. Controle o comportamento mobile:
 *    <CustomScrollArea mobileFallback={false}> // Força uso do Radix em mobile
 *    <CustomScrollArea mobileFallback={true}>  // Usa scroll nativo em mobile (padrão)
 * 
 * 6. O scrollbar se adapta automaticamente ao tema (claro/escuro)
 * 
 * Características:
 * - Scrollbar customizado que segue o tema
 * - Suporte a scroll vertical e horizontal
 * - Três tamanhos: thin, default, thick
 * - Opção de ocultar o scrollbar
 * - Transições suaves no hover
 * - Compatível com navegadores WebKit e Firefox
 * - Fallback automático para mobile (scroll nativo)
 * - Suporte a touch scrolling no mobile
 * - Layout responsivo que não corta conteúdo
 * 
 * Comportamento Mobile:
 * - Por padrão, usa scroll nativo no mobile (< 768px)
 * - Aplica scrollbar customizado apenas em desktop
 * - Mantém funcionalidade completa em todos os dispositivos
 * - Evita problemas de layout e conteúdo cortado
 */
