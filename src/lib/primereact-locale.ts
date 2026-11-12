import { addLocale, locale, LocaleOptions } from 'primereact/api';

let configured = false;

export function setupPrimeReactLocale(): void {
  if (configured) return;
  const baseEn = (locale('en')?.options || {}) as LocaleOptions;

  addLocale('pt-BR', {
    ...baseEn,
    accept: 'Sim',
    reject: 'Não',
    choose: 'Escolher',
    chooseDate: 'Escolher Data',
    chooseMonth: 'Escolher Mês',
    chooseYear: 'Escolher Ano',
    clear: 'Limpar',
    today: 'Hoje',
    cancel: 'Cancelar',
    apply: 'Aplicar',
    prevDecade: 'Década Anterior',
    nextDecade: 'Próxima Década',
    prevYear: 'Ano Anterior',
    nextYear: 'Próximo Ano',
    prevMonth: 'Mês Anterior',
    nextMonth: 'Próximo Mês',
    dateFormat: 'dd/mm/yy',
    firstDayOfWeek: 0,
    dayNames: [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado'
    ],
    dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    dayNamesMin: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
    monthNames: [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro'
    ],
    monthNamesShort: [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez'
    ],
    emptyMessage: 'Nenhum registro encontrado',
    emptyFilterMessage: 'Nenhum resultado encontrado',
    passwordPrompt: 'Digite uma senha',
    weak: 'Fraca',
    medium: 'Média',
    strong: 'Forte',
    aria: {
      ...(baseEn.aria || {}),
      close: 'Fechar',
      previous: 'Anterior',
      next: 'Próximo',
      firstPageLabel: 'Primeira Página',
      lastPageLabel: 'Última Página',
      nextPageLabel: 'Próxima Página',
      prevPageLabel: 'Página Anterior',
      rowsPerPageLabel: 'Linhas por página',
      pageLabel: 'Página {page}'
    }
  });
  locale('pt-BR');
  configured = true;
}

// Inicializa imediatamente tanto em SSR quanto no cliente
setupPrimeReactLocale();
