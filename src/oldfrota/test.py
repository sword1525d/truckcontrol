import requests
from collections import defaultdict
from datetime import datetime

def calcular_economia_papel(empresa, setor, ano=None, mes=None):
    """
    Calcula a economia de papel após implementação do sistema digital.
    
    Args:
        empresa (str): Nome da empresa (ex: 'HONDA', 'LSL')
        setor (str): Setor da empresa
        ano (int, optional): Ano específico para filtrar. Se None, analisa todos os anos.
        mes (int, optional): Mês específico para filtrar (1-12). Se None, analisa todos os meses.
    
    Returns:
        dict: Dicionário com:
            - total_dias_com_corridas: total de dias com corridas
            - dias_com_excesso: dias com mais de 10 corridas
            - folhas_antigas: quantidade de folhas que seriam usadas antes
            - economia: sempre igual a folhas_antigas (pois agora é zero)
    """
    # URL do Firebase (substitua se necessário)
    firebase_url = f"https://lslcda-default-rtdb.firebaseio.com/{empresa}/{setor}/corridas.json"
    
    try:
        # Busca os dados do Firebase
        response = requests.get(firebase_url)
        response.raise_for_status()
        corridas = response.json()
        
        if not corridas:
            print("Nenhuma corrida encontrada.")
            return {
                'total_dias_com_corridas': 0,
                'dias_com_excesso': 0,
                'folhas_antigas': 0,
                'economia': 0
            }
        
        # Contador de corridas por dia
        corridas_por_dia = defaultdict(int)

        # Trata tanto lista quanto dicionário
        if isinstance(corridas, dict):
            iterable = corridas.items()
        elif isinstance(corridas, list):
            iterable = enumerate(corridas)
        else:
            print("Formato de dados inesperado.")
            return {
                'total_dias_com_corridas': 0,
                'dias_com_excesso': 0,
                'folhas_antigas': 0,
                'economia': 0
            }

        for corrida_id, corrida in iterable:
            if corrida and 'data' in corrida:
                try:
                    # Parse da data (formato dd/mm/yyyy)
                    data_str = corrida['data']
                    dia, mes_corrida, ano_corrida = map(int, data_str.split('/'))

                    # Filtra por ano/mês se especificado
                    if (ano is None or ano_corrida == ano) and \
                       (mes is None or mes_corrida == mes):

                        # Usa a data como chave (formato dd/mm/yyyy)
                        corridas_por_dia[data_str] += 1

                except (ValueError, AttributeError) as e:
                    print(f"Erro ao processar corrida {corrida_id}: {e}")
                    continue
        
        # Calcula o uso antigo de papel
        total_dias = len(corridas_por_dia)
        dias_com_excesso = sum(1 for qtd in corridas_por_dia.values() if qtd > 10)
        
        # Antes: 1 folha por dia + 1 folha extra para dias com >10 corridas
        folhas_antigas = total_dias + dias_com_excesso
        
        # Agora: 0 folhas (sistema digital)
        economia = folhas_antigas
        
        return {
            'total_dias_com_corridas': total_dias,
            'dias_com_excesso': dias_com_excesso,
            'folhas_antigas': folhas_antigas,
            'economia': economia
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Erro ao acessar o Firebase: {e}")
        return {
            'total_dias_com_corridas': 0,
            'dias_com_excesso': 0,
            'folhas_antigas': 0,
            'economia': 0
        }

# Exemplo de uso:
if __name__ == "__main__":
    # Configuração - ajuste conforme necessário
    EMPRESA = "LSL"  # ou "LSL"
    SETOR = "DIVISÃO DE PEÇAS - MANAUS"
    ANO = 2025          # None para todos os anos
    MES = 5             # None para todos os meses (1-12), 5 = maio
    
    print(f"Analisando dados para {EMPRESA}/{SETOR}...")
    if ANO:
        print(f"Ano: {ANO}")
    if MES:
        print(f"Mês: {MES}")
    
    # Executa a análise
    resultado = calcular_economia_papel(EMPRESA, SETOR, ANO, MES)
    
    # Exibe os resultados
    print("\n=== Relatório de Economia de Papel ===")
    print(f"Total de dias com corridas: {resultado['total_dias_com_corridas']}")
    print(f"Dias com mais de 10 corridas: {resultado['dias_com_excesso']}")
    print(f"\nSistema antigo gastaria: {resultado['folhas_antigas']} folhas")
    print(f"Economia com sistema digital: {resultado['economia']} folhas")
    
    if resultado['total_dias_com_corridas'] > 0:
        print("\nDetalhe da economia:")
        print("- Antes: 1 folha para cada dia com corridas")
        print("- Antes: +1 folha extra para cada dia com >10 corridas")
        print("- Agora: 0 folhas (controle totalmente digital)")