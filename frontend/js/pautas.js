const datos = {
  Reglas: {
    cat1: {
      name: "ELIGIBILIDAD (ELIGIBILITY)",
      Descripcion: "Se utiliza para definir los requisitos de identificacion, el intervalo de edad y la localidad de un tipo  de paasajero si dichas condiciones existen. Aplicacion para tipo de pasajero especial. Por ejemplo: militares ,marinos , estudiantes,etc"

    },
    cat2: {
      name: "Aplicacion de DIA/HORA (DAY/TIME)",
      Descripcion: "Define horas y/o dias en los que el viaje esta o no esta permitido , la combinacion de dia/hora se aplica el origen de los componentes de tarifa programados para que salgan durante el tiempo especificado."
    },
    cat3: {
      name: "TEMPORALIDAD (SEASON)",
      Descripcion: "La suposicion para aplicar esta categoria es que una tarifa estacional se basa en la temporada de la porcoin de origen de la unidad tarifaria. Esta categoria se utiliza paraespecificar restricciones de fechas estacionales y promocionales."
    },
    cat4: {
      name: "Aplicaciones de vuelo (FLIGHT APPLY)",
      Descripcion: "Indica que la Tarifa solo es valida en numeros de vuelos especificados, a traves de ciertos puntos locales o en ciertos tipos de equipos deservicios de vuelo."
    },
    cat5: {
      name: "Reservas de emision de boletos por adelanto (ADV RES/TKTG)",
      Descripcion: "Se utiliza para definir los requisitos de reserva y emision de boletos aplicables a una Tarifa. Indicara que sectores de viaje, deben dse r confirmados antes de emitir el boleto."
    },
    cat6: {
      name: "Estadia mínima (MIN STAY)",
      Descripcion: "especifica el primer momento en el que debe comenzar el viaje de vuelta."
    },
    cat7: {
      name: "Estadia máxima (MAX STAY)",
      Descripcion: "Indica la ultima hora en el que el viaje puede completarse."
    },
    cat8: {
      name: "STOPOVERS (PARADAS CON ESTANCIA)",
      Descripcion: "Existe dos suposiciones : se asume que no se permitenescalas a menos que esta categoria esté presente y que , cuando se permioten , pueden hacerse en cualquier punto a lo largo de la ruta.Si el campo de moneda se codifica y el importe del campo de cargos es CERO, significa que se pueden realizar escalas sin cargo alguno"
    },
    cat9: {
      name: "Transbordos (TRANSFERS)",
      Descripcion: "Define las condiciones o restricciones bajo las que se pueden dar los transbordos y los tramos en superficie y los cargos aplicables, asi como las lineas aereas y ubicaciones asociadas a ellos"
    },
    cat10: {
      name: "Combinabilidad (COMBINATIONS)",
      Descripcion: "Establece si la Tarifa que nos interesa aplicar puede ser combinada con otras para formar diferentes tipos de viaje que pueden ser emitidos en el mismo boleto"
    },
    cat11: {
      name: "Periodo de Embargo (BLACKOUTS)",
      Descripcion: "Se utiliza para definir fechas simles o intervalos de fechas en las que no se permite el viaje. Por lo general, la fecha incluye el año. Sin embargo, si se aplican las mismas suspensiones todos los años, la parte del registro se deja en blanco"
    },
    cat12: {
      name: "Recargos o sobre-cuotas (SURCHARGES)",
      Descripcion: "Define las condiciones en las que se aplican recargos y la cantidad correspondiente. La suposicion es que se aplican recargos al componente de tarifa a menos que se indique lo contrario"
    },
    cat13: {
      name: "Viaje acompañado (ACCOMP TRAVEL)",
      Descripcion: "Se usa como componente de una norma cuando es necesario viajar con uno o mas pasajeros paracunmplir las condicionesde la tarifa"
    },
    cat14: {
      name: "Restricciones de viaje (TRAVEL RESTRICTIONS)",
      Descripcion: "Se usa cuando se establecen especificamente fechas de viaje en una norma. Contiene las fechas de inicio, expiracion y fin del viaje. Tambien indica si el viaje debe comenzar o terminar en una fecha/hora especifica."
    },
    cat15: {
      name: "Restricciones de venta (SALES RESTRICTIONS)",
      Descripcion: "Se usa para definir una tarifa disponible para su venta sujeta a restricciones basadas en la fecha, el tipo de transaccion del punto de venta o condiciones similares"
    },
    cat16: {
      name: "Penalizaciones (PENALITIES)",
      Descripcion: "Se usa para determinar si se aplican penalizaciones a esta tarifa y que recargos se evaluaran. La ausencia de esta categoria indica que no hay penalizacion por cambios o reembolsos enla parte del boleto que cubren esta tarifa"
    },
    cat18: {
      name: "Endosos del boleto (TICKET ENDORSMENT)",
      Descripcion: "Se usa para indicar los requisitos de endoso del boleto de acuerdo con una norma. Contiene el texto que se debe usar y la ubicacion del boleto necesaria para el endoso."
    },
    cat19_22: {
      name: "Descuentos",
      Descripcion: "Se usan para facilitar un importe de tarifa especifico. La Categoria 19 debe codificarse para descuentos para niños, la Categoria 20 para guia de tour, la Categoria 21 para los agentes de ventas y ña Categoria 22 para el resto de tipos de descuentos."
    },
    cat31: {
      name: "Cambios voluntarios (VOLUNTARY CHGS)",
      Descripcion: "Se definen las condiciones relacionadas con los clientes que realizan cambios voluntarios a su itinerario. Sin la categoria 31, las reemisiones de boletos deben realizarse manualmente."
    }

  },
  Casos: {
    Caso1: {
      title: "Caso de recálculo con uso de Override en SABRE",
      Conclusion: "- Cuando el agente usa override y la tarifa no cumple con las reglas, se considera un error y procede el débito \n" +
        "- En el caso expuesto, la tarifa correcta (sin override) resultó ser más alta que la cobrada por el agente, por lo que el débito es procedente.",
      fecha: '02-07-2026'
    },
    Caso2: {
      title: "Caso de Pasajeros INADMITIDOS / RECHAZO MIGRATORIO",
      Conclusion: "- Si no hay anotacion de rechazo migratorio, el debito es procedente. \n " +
        "- Se solicitara apoyo al equipo de tráfico para verificar como se documenta este tipo de eventos en otros sistemas",
      fecha: '02-07-2026'
    }
  },
  Tarifas: {
    Básicas: {
      Detalle: "AM Plus, Premier y Combinaciones no permitidas",
      Conclusion: "Se estará a la espera del documento unificado para aplicarlo en auditorias",
      fecha: '02-07-2026'
    },
    Negociadas: {
      Detalle: "Corporativa - sin Cod. Corporativo",
      Conclusion: "- Se debe verificar que el neuvo boleto mantenga el tkt designator corporativo \n" +
        "- Si el agente omitio colocarlo, se considerara error y se aplicaran cargos administrativos.",
      fecha: '02-07-2026'
    }
  },
  Vouchers: {
    Compensaciones: {

      Procesos: {
        Proceso1: "Proceso de solicitud de pago en Aeropuertos",
        pasos: [
          {
            "paso": 1,
            "descripcion": "El Agente de servicio al cliente ingresa al Formulario que está disponible a través del SharePoint https://grupoaeromexico.sharepoint.com/sites/AMPol%C3%ADticasYProcesos/Pages/Inicio2.aspx"
          },
          {
            "paso": 2,
            "descripcion": "Se capturan los datos requeridos por el Formulario."
          },
          {
            "paso": 3,
            "descripcion": "El Agente valida y confirma la información con el cliente y envía la solicitud."
          },
          {
            "paso": 4,
            "descripcion": "El sistema genera un número de folio, que se envía al cliente por correo electrónico y que a su vez confirma el agente de servicio al cliente."
          },
          {
            "paso": 5,
            "descripcion": "Una vez generado el folio, el equipo de Atención a Clientes dará seguimiento conforme al proceso correspondiente."
          }
        ],
        nota: "Este proceso se encuentra en fase de implementación gradual en todas las estaciones de GAM. Para las estaciones donde aún no se ha habilitado, se continuará aplicando el procedimiento anterior, utilizando monedero electrónico o EMD RFND TO CASH, según corresponda en cada caso. Esta información puede ser consultada en el comunicado “134-24 Formulario de Atención a Clientes para Solicitud de Compensaciones en Efectivo”."
      },
      fecha: '02-07-2026'
    }

  }
};
